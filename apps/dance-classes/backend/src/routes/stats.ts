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

// Weekly streak rule: ≥ this many distinct videos watched in a Mon→Sun week.
// User asked for "any class is enough" — one is enough.
const WEEKLY_VIDEOS_TARGET = 1;
// Secondary weekly goal (motivational, doesn't affect streak).
const WEEKLY_MINUTES_TARGET = 60;

function isoMondayOf(d: Date): string {
  // Monday-of-the-week as YYYY-MM-DD in local time.
  const dow = d.getDay() || 7; // Sun -> 7
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - (dow - 1));
  return m.toISOString().slice(0, 10);
}

function endOfWeek(d: Date): Date {
  // Sunday 23:59:59.999 of the week containing d, local time.
  const dow = d.getDay() || 7;
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  e.setDate(e.getDate() + (7 - dow));
  return e;
}

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

    // ---- Days practiced (kept for ad-hoc use) ----------------------------
    const distinctDays = db.prepare<[number], DistinctDayRow>(`
      SELECT DISTINCT DATE(updated_at, 'unixepoch', 'localtime') AS day
      FROM progress
      WHERE position_seconds > ?
      ORDER BY day DESC
    `).all(MIN_SECONDS_FOR_PRACTICE) as DistinctDayRow[];
    const daySet = new Set(distinctDays.map(d => d.day));
    const daysPracticed = daySet.size;

    // ---- Weekly streak ---------------------------------------------------
    // The streak rule is "≥ N distinct videos in a Mon→Sun week". Build a
    // map of week-start (Monday) → distinct videos that week, then walk
    // backwards from this week to count consecutive qualifying weeks.
    interface WeekVidsRow { week_start: string; videos: number; seconds: number }
    const weekVidsRows = db.prepare<[number], WeekVidsRow>(`
      SELECT
        DATE(updated_at, 'unixepoch', 'localtime', 'weekday 1', '-7 days') AS week_start,
        COUNT(DISTINCT video_id)                                            AS videos,
        SUM(CASE WHEN watched = 1 AND duration_seconds IS NOT NULL THEN duration_seconds ELSE position_seconds END) AS seconds
      FROM progress
      WHERE position_seconds > ?
      GROUP BY week_start
    `).all(MIN_SECONDS_FOR_PRACTICE);
    const weekVidsByMonday = new Map(weekVidsRows.map(w => [w.week_start, w]));

    const now = new Date();
    const thisMonday = isoMondayOf(now);
    const weekEndDate = endOfWeek(now);

    const thisWeekVideos = weekVidsByMonday.get(thisMonday)?.videos ?? 0;
    const thisWeekSeconds = weekVidsByMonday.get(thisMonday)?.seconds ?? 0;

    // Walk back week by week from this week, then last week, etc.
    function priorMonday(monday: string, weeksBack: number): string {
      const d = new Date(monday + 'T00:00:00');
      d.setDate(d.getDate() - 7 * weeksBack);
      return d.toISOString().slice(0, 10);
    }

    let currentStreak = 0;
    {
      // If this week qualifies, include it; otherwise start counting from
      // last week so the streak survives until Sunday midnight if last week
      // was a qualifier.
      const startOffset = thisWeekVideos >= WEEKLY_VIDEOS_TARGET ? 0 : 1;
      let i = startOffset;
      // safety: don't loop more than 5 years
      while (i < 260) {
        const wk = priorMonday(thisMonday, i);
        const v = weekVidsByMonday.get(wk)?.videos ?? 0;
        if (v >= WEEKLY_VIDEOS_TARGET) currentStreak++;
        else break;
        i++;
      }
    }
    // Longest qualifying-week run, ever.
    let longestStreak = 0;
    {
      const sortedWeeks = [...weekVidsByMonday.keys()].sort();
      let prev: Date | null = null;
      let run = 0;
      for (const wk of sortedWeeks) {
        const v = weekVidsByMonday.get(wk)?.videos ?? 0;
        if (v < WEEKLY_VIDEOS_TARGET) { prev = null; run = 0; continue; }
        const d = new Date(wk + 'T00:00:00');
        if (prev) {
          const gapWeeks = Math.round((d.getTime() - prev.getTime()) / (86400000 * 7));
          run = gapWeeks === 1 ? run + 1 : 1;
        } else run = 1;
        if (run > longestStreak) longestStreak = run;
        prev = d;
      }
    }

    // Streak is "at risk" if it's Sunday and we haven't yet hit the goal
    // this week — but only if there's a streak to lose (i.e. last week
    // qualified, or some earlier streak chain is still active).
    const isSundayLocal = now.getDay() === 0;
    const lastWeekQualified = (weekVidsByMonday.get(priorMonday(thisMonday, 1))?.videos ?? 0) >= WEEKLY_VIDEOS_TARGET;
    const atRisk = isSundayLocal
      && thisWeekVideos < WEEKLY_VIDEOS_TARGET
      && (lastWeekQualified || currentStreak > 0);

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
      streak: {
        current:  currentStreak,
        longest:  longestStreak,
        atRisk,
        // Frontend uses this to render a "until midnight Sunday" countdown.
        endsAt:   Math.floor(weekEndDate.getTime() / 1000),
        // Boolean shortcut — UI may want to differentiate Sunday from "any day"
        isSunday: isSundayLocal
      },
      weekGoals: {
        videos:  { current: thisWeekVideos, target: WEEKLY_VIDEOS_TARGET, met: thisWeekVideos >= WEEKLY_VIDEOS_TARGET },
        minutes: { current: Math.round(thisWeekSeconds / 60), target: WEEKLY_MINUTES_TARGET, met: thisWeekSeconds / 60 >= WEEKLY_MINUTES_TARGET }
      },
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

  // -------------------------------------------------------------------------
  // /api/stats/list — drill-down: which videos contributed to a given stat?
  //   ?range = 'this-week' | 'this-month' | 'last-30' | 'all'
  //   ?date  = 'YYYY-MM-DD' (overrides range; returns just that calendar day)
  // -------------------------------------------------------------------------
  interface ListRow {
    id: number;
    display_title: string;
    duration_sec: number | null;
    has_thumb: number;
    folder_id: number;
    folder_name: string;
    position_seconds: number;
    duration_seconds: number | null;
    watched: number;
    updated_at: number;
  }

  app.get<{ Querystring: { range?: string; date?: string } }>('/api/stats/list', async (req, reply) => {
    const range = (req.query?.range ?? 'this-week').toString();
    const date  = req.query?.date?.toString();

    // Recompute Monday-of-this-week in this scope (the other handler's
    // closure isn't visible here).
    const monday = isoMondayOf(new Date());
    const lastMonday = (() => {
      const d = new Date(monday + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    })();

    let where = 'p.position_seconds > ?';
    const args: unknown[] = [MIN_SECONDS_FOR_PRACTICE];

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      where += " AND DATE(p.updated_at, 'unixepoch', 'localtime') = ?";
      args.push(date);
    } else if (range === 'this-week') {
      where += " AND DATE(p.updated_at, 'unixepoch', 'localtime') >= ?";
      args.push(monday);
    } else if (range === 'last-week') {
      where += " AND DATE(p.updated_at, 'unixepoch', 'localtime') >= ? AND DATE(p.updated_at, 'unixepoch', 'localtime') < ?";
      args.push(lastMonday);
      args.push(monday);
    } else if (range === 'this-month' || range === 'last-30') {
      where += ` AND p.updated_at >= unixepoch('now', '-30 days')`;
    } else if (range !== 'all') {
      return reply.code(400).send({ error: `Unknown range: ${range}` });
    }

    const sql = `
      SELECT
        v.id, v.display_title, v.duration_sec,
        CASE WHEN v.thumb_path IS NOT NULL THEN 1 ELSE 0 END AS has_thumb,
        v.folder_id, f.display_name AS folder_name,
        p.position_seconds, p.duration_seconds, p.watched, p.updated_at
      FROM progress p
      JOIN videos v  ON v.id = p.video_id
      JOIN folders f ON f.id = v.folder_id
      WHERE ${where}
      ORDER BY p.updated_at DESC
      LIMIT 200
    `;
    const rows = db.prepare<unknown[], ListRow>(sql).all(...args);
    return {
      items: rows.map(r => ({
        id: r.id,
        title: r.display_title,
        durationSec: r.duration_sec,
        hasThumb: !!r.has_thumb,
        folderId: r.folder_id,
        folderName: r.folder_name,
        position: r.position_seconds,
        progressDuration: r.duration_seconds,
        watched: !!r.watched,
        updatedAt: r.updated_at
      }))
    };
  });
}
