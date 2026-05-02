import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { DB } from '../db/index.js';

interface TotalsRow {
  classes_started: number;
  classes_completed: number;
  total_seconds: number;
}

interface DayBucket { day: string; classes: number; seconds: number }
interface WeekBucket { week_start: string; classes: number; seconds: number }

interface TopVideoRow {
  id: number;
  display_title: string;
  duration_sec: number | null;
  has_thumb: number;
  folder_id: number;
  folder_name: string;
  position_seconds: number;
  watched: number;
  updated_at: number;
}

interface TopFolderRow {
  id: number;
  display_name: string;
  classes_started: number;
  classes_completed: number;
  seconds: number;
}

interface DistinctDayRow { day: string }

// "Practiced today" threshold: at least 30s of progress on at least one
// video on that calendar day, in the server's local timezone.
const MIN_SECONDS_FOR_PRACTICE = 30;

export async function registerStatsRoutes(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { db: DB }
): Promise<void> {
  const { db } = opts;

  app.get('/api/stats', async () => {
    // ---- Totals ----------------------------------------------------------
    const totals = db.prepare<[number], TotalsRow>(`
      SELECT
        COUNT(*)                                                      AS classes_started,
        COALESCE(SUM(CASE WHEN watched = 1 THEN 1 ELSE 0 END), 0)     AS classes_completed,
        COALESCE(
          SUM(
            CASE
              WHEN watched = 1 AND duration_seconds IS NOT NULL THEN duration_seconds
              ELSE position_seconds
            END
          ), 0
        )                                                             AS total_seconds
      FROM progress
      WHERE position_seconds > ?
    `).get(MIN_SECONDS_FOR_PRACTICE) ?? { classes_started: 0, classes_completed: 0, total_seconds: 0 };

    const favoritesCount = (db.prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM favorites').get()?.c) ?? 0;
    const totalVideos    = (db.prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM videos').get()?.c) ?? 0;

    // ---- Daily activity (last 30 calendar days) --------------------------
    const dailyRows = db.prepare<[number], DayBucket>(`
      SELECT
        DATE(updated_at, 'unixepoch', 'localtime') AS day,
        COUNT(DISTINCT video_id)                   AS classes,
        SUM(
          CASE
            WHEN watched = 1 AND duration_seconds IS NOT NULL THEN duration_seconds
            ELSE position_seconds
          END
        )                                          AS seconds
      FROM progress
      WHERE position_seconds > ?
        AND updated_at >= unixepoch('now', '-30 days')
      GROUP BY day
      ORDER BY day ASC
    `).all(MIN_SECONDS_FOR_PRACTICE);
    const dailyByDay = new Map(dailyRows.map(d => [d.day, d]));
    const daily30: DayBucket[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const hit = dailyByDay.get(key);
      daily30.push({ day: key, classes: hit?.classes ?? 0, seconds: hit?.seconds ?? 0 });
    }

    // ---- Weekly activity (last 12 weeks, week starts Monday) -------------
    // strftime('%w', ...) gives 0 (Sun) .. 6 (Sat). To pin Monday-starts we
    // shift by 6 days then take the week boundary.
    const weeklyRows = db.prepare<[number], WeekBucket>(`
      SELECT
        DATE(updated_at, 'unixepoch', 'localtime', 'weekday 1', '-7 days') AS week_start,
        COUNT(DISTINCT video_id)                                             AS classes,
        SUM(
          CASE
            WHEN watched = 1 AND duration_seconds IS NOT NULL THEN duration_seconds
            ELSE position_seconds
          END
        )                                                                    AS seconds
      FROM progress
      WHERE position_seconds > ?
        AND updated_at >= unixepoch('now', '-84 days')
      GROUP BY week_start
      ORDER BY week_start ASC
    `).all(MIN_SECONDS_FOR_PRACTICE);
    const weeklyByDay = new Map(weeklyRows.map(w => [w.week_start, w]));
    const weekly12: WeekBucket[] = [];
    {
      const today = new Date();
      // Monday-of-this-week in ISO
      const dow = today.getDay() || 7; // Sun -> 7
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dow - 1));
      for (let i = 11; i >= 0; i--) {
        const start = new Date(monday);
        start.setDate(monday.getDate() - i * 7);
        const key = start.toISOString().slice(0, 10);
        const hit = weeklyByDay.get(key);
        weekly12.push({ week_start: key, classes: hit?.classes ?? 0, seconds: hit?.seconds ?? 0 });
      }
    }

    // ---- Streak ----------------------------------------------------------
    const distinctDays = db.prepare<[number], DistinctDayRow>(`
      SELECT DISTINCT DATE(updated_at, 'unixepoch', 'localtime') AS day
      FROM progress
      WHERE position_seconds > ?
      ORDER BY day DESC
    `).all(MIN_SECONDS_FOR_PRACTICE) as DistinctDayRow[];
    const daySet = new Set(distinctDays.map(d => d.day));
    const todayKey = new Date().toISOString().slice(0, 10);
    const yesterdayKey = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

    let currentStreak = 0;
    if (daySet.has(todayKey) || daySet.has(yesterdayKey)) {
      const cursor = new Date();
      // If today wasn't logged but yesterday was, start counting from yesterday.
      if (!daySet.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
      while (daySet.has(cursor.toISOString().slice(0, 10))) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }
    let longestStreak = 0;
    {
      const sorted = [...daySet].sort(); // ascending
      let run = 0;
      let prev: Date | null = null;
      for (const k of sorted) {
        const d = new Date(k + 'T00:00:00');
        if (prev) {
          const gap = Math.round((d.getTime() - prev.getTime()) / 86400000);
          if (gap === 1) run++;
          else run = 1;
        } else run = 1;
        if (run > longestStreak) longestStreak = run;
        prev = d;
      }
    }
    const daysPracticed = daySet.size;

    // ---- This week / month bounded sums ----------------------------------
    const since = (relative: string): number => {
      const stmt = db.prepare<[string], { ts: number }>(`SELECT unixepoch('now', ?) AS ts`);
      return stmt.get(relative)?.ts ?? 0;
    };
    const periodStats = (sinceTs: number) => {
      const r = db.prepare<[number, number], { classes: number; seconds: number; days: number }>(`
        SELECT
          COUNT(DISTINCT video_id)                                         AS classes,
          COALESCE(SUM(CASE WHEN watched=1 AND duration_seconds IS NOT NULL THEN duration_seconds ELSE position_seconds END), 0) AS seconds,
          COUNT(DISTINCT DATE(updated_at, 'unixepoch', 'localtime'))       AS days
        FROM progress
        WHERE position_seconds > ? AND updated_at >= ?
      `).get(MIN_SECONDS_FOR_PRACTICE, sinceTs);
      return { classes: r?.classes ?? 0, seconds: r?.seconds ?? 0, days: r?.days ?? 0 };
    };

    // ---- Top videos ------------------------------------------------------
    const topVideos = db.prepare<[number, number], TopVideoRow>(`
      SELECT
        v.id,
        v.display_title,
        v.duration_sec,
        CASE WHEN v.thumb_path IS NOT NULL THEN 1 ELSE 0 END AS has_thumb,
        v.folder_id,
        f.display_name AS folder_name,
        p.position_seconds,
        p.watched,
        p.updated_at
      FROM progress p
      JOIN videos v  ON v.id = p.video_id
      JOIN folders f ON f.id = v.folder_id
      WHERE p.position_seconds > ?
      ORDER BY (CASE WHEN p.watched = 1 AND p.duration_seconds IS NOT NULL THEN p.duration_seconds ELSE p.position_seconds END) DESC,
               p.updated_at DESC
      LIMIT ?
    `).all(MIN_SECONDS_FOR_PRACTICE, 10);

    // ---- Top folders -----------------------------------------------------
    const topFolders = db.prepare<[number, number], TopFolderRow>(`
      SELECT
        f.id,
        f.display_name,
        COUNT(DISTINCT p.video_id)                                                    AS classes_started,
        SUM(CASE WHEN p.watched = 1 THEN 1 ELSE 0 END)                                AS classes_completed,
        SUM(CASE WHEN p.watched = 1 AND p.duration_seconds IS NOT NULL THEN p.duration_seconds ELSE p.position_seconds END) AS seconds
      FROM progress p
      JOIN videos v  ON v.id = p.video_id
      JOIN folders f ON f.id = v.folder_id
      WHERE p.position_seconds > ?
      GROUP BY f.id, f.display_name
      ORDER BY seconds DESC
      LIMIT ?
    `).all(MIN_SECONDS_FOR_PRACTICE, 8);

    return {
      total: {
        classesStarted:   Number(totals.classes_started),
        classesCompleted: Number(totals.classes_completed),
        seconds:          Number(totals.total_seconds),
        favorites:        Number(favoritesCount),
        videosInLibrary:  Number(totalVideos),
        daysPracticed
      },
      thisWeek:  periodStats(since('-7 days')),
      thisMonth: periodStats(since('-30 days')),
      streak: { current: currentStreak, longest: longestStreak },
      daily30,
      weekly12,
      topVideos: topVideos.map(v => ({
        id: v.id,
        title: v.display_title,
        durationSec: v.duration_sec,
        hasThumb: !!v.has_thumb,
        folderId: v.folder_id,
        folderName: v.folder_name,
        position: v.position_seconds,
        watched: !!v.watched,
        updatedAt: v.updated_at
      })),
      topFolders: topFolders.map(f => ({
        id: f.id,
        name: f.display_name,
        classesStarted: Number(f.classes_started),
        classesCompleted: Number(f.classes_completed),
        seconds: Number(f.seconds)
      }))
    };
  });
}
