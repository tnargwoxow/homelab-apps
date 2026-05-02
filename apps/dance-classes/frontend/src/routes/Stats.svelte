<script lang="ts">
  import { onMount } from 'svelte';
  import { link, push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import type { StatsPayload } from '../lib/api';
  import { theme } from '../lib/stores';
  import Sparkle from '../components/Sparkle.svelte';
  import StatsListModal from '../components/StatsListModal.svelte';
  import StreakFlame from '../components/StreakFlame.svelte';
  import { celebrate } from '../lib/celebrate';

  const STREAK_STORAGE_KEY = 'mimi:lastSeenStreak';

  let modalOpen = $state(false);
  let modalCfg = $state<{ title: string; subtitle: string; range: string; date?: string }>({
    title: '', subtitle: '', range: 'this-week'
  });
  function openList(title: string, subtitle: string, range: string, date?: string) {
    modalCfg = { title, subtitle, range, date };
    modalOpen = true;
  }

  let data = $state<StatsPayload | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      data = await api.stats();
      const prev = Number(window.localStorage.getItem(STREAK_STORAGE_KEY) ?? 0);
      if (data.streak.current > prev) celebrate('big');
      window.localStorage.setItem(STREAK_STORAGE_KEY, String(data.streak.current));
    }
    catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  });

  function fmtMinutes(seconds: number): string {
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  }

  function fmtHours(seconds: number): string {
    const h = seconds / 3600;
    if (h >= 10) return `${Math.round(h)}h`;
    if (h >= 1)  return `${h.toFixed(1)}h`;
    return `${Math.round(seconds / 60)}m`;
  }

  function shortDay(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  // Achievements — each has a threshold and a "stat" key from data.
  // Showing locked + progress bar gives the user something to chase.
  // `kind` controls which list to open when the tile is tapped.
  interface Achievement {
    icon: string;
    label: string;
    target: number;
    actual: number;
    suffix?: string;
    kind: 'classes-started' | 'classes-completed' | 'time' | 'streak' | 'favorites';
  }
  let achievements = $derived<Achievement[]>(data ? [
    { icon: '🌱', label: 'First class',         target: 1,       actual: data.total.classesStarted,   kind: 'classes-started' },
    { icon: '💃', label: '5 classes completed', target: 5,       actual: data.total.classesCompleted, kind: 'classes-completed' },
    { icon: '🎯', label: '25 classes',          target: 25,      actual: data.total.classesCompleted, kind: 'classes-completed' },
    { icon: '🏆', label: '100 classes',         target: 100,     actual: data.total.classesCompleted, kind: 'classes-completed' },
    { icon: '⏱️', label: '1 hour total',        target: 3600,    actual: data.total.seconds, suffix: 'time', kind: 'time' },
    { icon: '⏱️⏱️', label: '10 hours total',    target: 36000,   actual: data.total.seconds, suffix: 'time', kind: 'time' },
    { icon: '⏱️🏅', label: '100 hours total',    target: 360000,  actual: data.total.seconds, suffix: 'time', kind: 'time' },
    { icon: '🔥',  label: '3-week streak',      target: 3,       actual: data.streak.longest,         kind: 'streak' },
    { icon: '🔥🔥', label: '7-week streak',      target: 7,       actual: data.streak.longest,         kind: 'streak' },
    { icon: '🔥🔥🔥', label: '30-week streak',   target: 30,      actual: data.streak.longest,         kind: 'streak' },
    { icon: '⭐',  label: 'First favorite',     target: 1,       actual: data.total.favorites,        kind: 'favorites' },
    { icon: '⭐⭐', label: '10 favorites',       target: 10,      actual: data.total.favorites,        kind: 'favorites' }
  ] : []);

  function openAchievement(a: Achievement) {
    if (a.kind === 'favorites') {
      push('/favorites');
      return;
    }
    const titles: Record<typeof a.kind, string> = {
      'classes-started':   'Every class you\'ve started',
      'classes-completed': 'Every class you\'ve started',
      'time':              'Every class you\'ve watched',
      'streak':            'Every class you\'ve watched',
      'favorites':         ''
    };
    const subtitles: Record<typeof a.kind, string> = {
      'classes-started':   `${a.label} — ${a.actual} of ${a.target}`,
      'classes-completed': `${a.label} — ${a.actual} of ${a.target} (look for ✓ watched)`,
      'time':              `${a.label} — ${fmtMinutes(a.actual)} of ${fmtMinutes(a.target)}`,
      'streak':            `${a.label} — best ${a.actual} weeks`,
      'favorites':         ''
    };
    openList(titles[a.kind], subtitles[a.kind], 'all');
  }

  // Heatmap intensity: 0..1 based on max minutes per day (excluding zero days).
  let dailyMax = $derived(data ? Math.max(1, ...data.daily30.map(d => d.seconds)) : 1);
  function heatColor(seconds: number): string {
    if (seconds <= 0) return 'var(--theme-card-ring)';
    const r = Math.min(1, seconds / dailyMax);
    // CSS color-mix isn't universally supported on older Android; build a
    // gradient between the theme accent and theme-pill-hover via opacity.
    return `color-mix(in srgb, var(--theme-accent) ${Math.round(20 + r * 80)}%, transparent)`;
  }

  let weeklyMax = $derived(data ? Math.max(1, ...data.weekly12.map(w => w.seconds)) : 1);
</script>

<div class="mb-6">
  <h1 class="font-display text-3xl sm:text-4xl" style="color: var(--theme-text-strong);">
    <Sparkle class="-mt-1 mr-1 inline-block h-5 w-5" />
    Your Stats
  </h1>
  <p class="mt-1 text-sm" style="color: var(--theme-text-muted);">
    Everything you've watched, all the way back.
  </p>
</div>

{#if loading}
  <div class="py-20 text-center" style="color: var(--theme-text-muted);">Crunching numbers…</div>
{:else if error}
  <div class="py-10 text-center" style="color: var(--theme-accent-2);">{error}</div>
{:else if data}
  {@const d = data}

  <!-- Hero numbers (clickable: open the videos that made up the stat) -->
  <section class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each [
      { label: 'Watch time',   value: fmtHours(d.total.seconds),                        sub: 'all-time',
        title: 'All-time watch history', subtitle: 'Every lesson you\'ve started', range: 'all' },
      { label: 'Classes done', value: String(d.total.classesCompleted),                 sub: `${d.total.classesStarted} started`,
        title: 'All-time history', subtitle: 'Lessons started', range: 'all' },
      { label: 'Streak',       value: String(d.streak.current),                          sub: `${d.streak.current === 1 ? 'week' : 'weeks'} · best ${d.streak.longest}`,
        title: 'This week', subtitle: 'Lessons that count toward your streak', range: 'this-week' },
      { label: 'Favorites',    value: String(d.total.favorites),                         sub: `of ${d.total.videosInLibrary}`,
        title: '', subtitle: '', range: '' }
    ] as card}
      {#if card.range}
        <button
          type="button"
          class="rounded-2xl p-4 text-left ring-1 shadow-sm transition"
          style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring);
                 border-color: var(--theme-card-ring); box-shadow: var(--theme-card-shadow);"
          onclick={() => openList(card.title, card.subtitle, card.range)}
        >
          <div class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--theme-text-muted);">{card.label}</div>
          {#if card.label === 'Streak' && d.streak.current > 0}
            <div class="mt-1"><StreakFlame days={d.streak.current} size="lg" atRisk={d.streak.atRisk} /></div>
          {:else}
            <div class="mt-1 font-display text-3xl leading-none" style="color: var(--theme-text-strong);">{card.value}</div>
          {/if}
          <div class="mt-1 text-xs" style="color: var(--theme-text-muted);">{card.sub}</div>
        </button>
      {:else}
        <a use:link href="/favorites"
           class="block rounded-2xl p-4 ring-1 shadow-sm transition"
           style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring);
                  border-color: var(--theme-card-ring); box-shadow: var(--theme-card-shadow);">
          <div class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--theme-text-muted);">{card.label}</div>
          <div class="mt-1 font-display text-3xl leading-none" style="color: var(--theme-text-strong);">{card.value}</div>
          <div class="mt-1 text-xs" style="color: var(--theme-text-muted);">{card.sub}</div>
        </a>
      {/if}
    {/each}
  </section>

  <!-- This week vs this month — both clickable -->
  <section class="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
    {#each [
      { label: 'This week',  block: d.thisWeek,  range: 'this-week',  subtitle: 'Lessons watched since Monday' },
      { label: 'This month', block: d.thisMonth, range: 'last-30',    subtitle: 'Last 30 days' }
    ] as p}
      <button
        type="button"
        class="rounded-2xl p-4 text-left ring-1 shadow-sm transition"
        style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);"
        onclick={() => openList(p.label, p.subtitle, p.range)}
      >
        <div class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--theme-text-muted);">{p.label}</div>
        <div class="mt-2 flex items-baseline gap-3" style="color: var(--theme-text-strong);">
          <span class="font-display text-2xl">{fmtMinutes(p.block.seconds)}</span>
          <span class="text-sm" style="color: var(--theme-text-muted);">{p.block.classes} classes · {p.block.days} days</span>
        </div>
      </button>
    {/each}
  </section>

  <!-- 30-day heatmap -->
  <section class="mb-8 rounded-2xl p-4 ring-1 shadow-sm"
           style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
    <h2 class="mb-3 flex items-baseline justify-between">
      <span class="font-display text-xl" style="color: var(--theme-text-strong);">Last 30 days</span>
      <span class="text-xs" style="color: var(--theme-text-muted);">
        {Math.round(d.daily30.reduce((a, x) => a + x.seconds, 0) / 60)} min total
      </span>
    </h2>
    <div class="grid grid-cols-15 gap-1 sm:grid-cols-30" style="grid-template-columns: repeat(15, minmax(0,1fr));">
      {#each d.daily30 as day (day.day)}
        <button
          type="button"
          class="aspect-square rounded-md ring-1 transition"
          title="{day.day}: {fmtMinutes(day.seconds)} · {day.classes} classes"
          style="background: {heatColor(day.seconds)}; --tw-ring-color: var(--theme-card-ring);"
          disabled={day.classes === 0}
          onclick={() => openList(shortDay(day.day), `${fmtMinutes(day.seconds)} watched`, 'all', day.day)}
        ></button>
      {/each}
    </div>
    <div class="mt-2 flex items-center justify-between text-[11px]" style="color: var(--theme-text-muted);">
      <span>{shortDay(d.daily30[0]?.day ?? '')}</span>
      <span class="hidden sm:inline">today</span>
      <span>{shortDay(d.daily30[d.daily30.length - 1]?.day ?? '')}</span>
    </div>
  </section>

  <!-- Weekly bars -->
  <section class="mb-8 rounded-2xl p-4 ring-1 shadow-sm"
           style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
    <h2 class="mb-3 font-display text-xl" style="color: var(--theme-text-strong);">Last 12 weeks</h2>
    <div class="flex h-32 items-end gap-1.5">
      {#each d.weekly12 as w (w.week_start)}
        {@const pct = Math.round((w.seconds / weeklyMax) * 100)}
        <div class="flex h-full flex-1 flex-col items-center justify-end gap-1" title="Week of {shortDay(w.week_start)}: {fmtMinutes(w.seconds)} · {w.classes} classes">
          <div class="w-full rounded-md transition" style="height: {Math.max(2, pct)}%; background: linear-gradient(180deg, var(--theme-accent), var(--theme-accent-2));"></div>
        </div>
      {/each}
    </div>
    <div class="mt-2 flex justify-between text-[11px]" style="color: var(--theme-text-muted);">
      <span>{shortDay(d.weekly12[0]?.week_start ?? '')}</span>
      <span>{shortDay(d.weekly12[d.weekly12.length - 1]?.week_start ?? '')}</span>
    </div>
  </section>

  <!-- Top folders -->
  {#if d.topFolders.length > 0}
    <section class="mb-8 rounded-2xl p-4 ring-1 shadow-sm"
             style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
      <h2 class="mb-3 font-display text-xl" style="color: var(--theme-text-strong);">Top series</h2>
      <ul class="space-y-2">
        {#each d.topFolders as f, i (f.id)}
          {@const pct = Math.round((f.seconds / d.topFolders[0].seconds) * 100)}
          <li>
            <a use:link href={`/folder/${f.id}`} class="block rounded-xl p-2 transition"
               onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
               onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}>
              <div class="flex items-baseline gap-2">
                <span class="w-6 shrink-0 text-right text-sm" style="color: var(--theme-text-muted);">{i + 1}</span>
                <span class="min-w-0 flex-1 truncate text-sm font-semibold" style="color: var(--theme-text-strong);">{f.name}</span>
                <span class="shrink-0 text-xs" style="color: var(--theme-text-muted);">{fmtMinutes(f.seconds)}</span>
              </div>
              <div class="ml-8 mt-1 h-1.5 overflow-hidden rounded-full" style="background: var(--theme-card-ring);">
                <div class="h-full" style="width: {pct}%; background: linear-gradient(90deg, var(--theme-accent), var(--theme-accent-2));"></div>
              </div>
              <div class="ml-8 mt-1 text-[11px]" style="color: var(--theme-text-muted);">
                {f.classesCompleted} done · {f.classesStarted} started
              </div>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Top videos -->
  {#if d.topVideos.length > 0}
    <section class="mb-8 rounded-2xl p-4 ring-1 shadow-sm"
             style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
      <h2 class="mb-3 font-display text-xl" style="color: var(--theme-text-strong);">Most-watched lessons</h2>
      <ul class="space-y-2">
        {#each d.topVideos as v, i (v.id)}
          <li>
            <a use:link href={`/watch/${v.id}`} class="flex items-center gap-3 rounded-xl p-2 transition"
               onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
               onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}>
              <span class="w-6 shrink-0 text-right text-sm" style="color: var(--theme-text-muted);">{i + 1}</span>
              {#if v.hasThumb}
                <img src={api.thumbUrl(v.id)} alt="" loading="lazy"
                     class="h-10 w-16 shrink-0 rounded-md object-cover ring-1"
                     style="--tw-ring-color: var(--theme-card-ring);" />
              {:else}
                <div class="h-10 w-16 shrink-0 rounded-md ring-1"
                     style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring);"></div>
              {/if}
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold" style="color: var(--theme-text-strong);">{v.title}</div>
                <div class="truncate text-[11px]" style="color: var(--theme-text-muted);">{v.folderName}</div>
              </div>
              <span class="shrink-0 text-xs" style="color: var(--theme-text-muted);">
                {v.watched ? '✓ ' : ''}{fmtMinutes(v.position)}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Achievements -->
  <section class="mb-8 rounded-2xl p-4 ring-1 shadow-sm"
           style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
    <h2 class="mb-3 font-display text-xl" style="color: var(--theme-text-strong);">Achievements</h2>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {#each achievements as a}
        {@const unlocked = a.actual >= a.target}
        {@const ratio = Math.min(1, a.actual / a.target)}
        <button
          type="button"
          class="rounded-xl p-3 text-left ring-1 transition active:scale-[0.98]"
          style="background: {unlocked ? 'var(--theme-pill-hover)' : 'transparent'};
                 --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);
                 opacity: {unlocked ? 1 : 0.7};"
          aria-label="See classes for: {a.label}"
          onclick={() => openAchievement(a)}
        >
          <div class="flex items-baseline gap-2">
            <span class="text-2xl" style="filter: {unlocked ? 'none' : 'grayscale(0.7)'};">{a.icon}</span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold" style="color: var(--theme-text-strong);">{a.label}</div>
              {#if !unlocked}
                <div class="mt-0.5 h-1 overflow-hidden rounded-full" style="background: var(--theme-card-ring);">
                  <div class="h-full" style="width: {ratio * 100}%; background: var(--theme-accent);"></div>
                </div>
                <div class="mt-0.5 text-[10px]" style="color: var(--theme-text-muted);">
                  {a.suffix === 'time' ? `${fmtMinutes(a.actual)} / ${fmtMinutes(a.target)}` : `${a.actual} / ${a.target}`}
                </div>
              {:else}
                <div class="mt-0.5 text-[10px]" style="color: var(--theme-accent);">Unlocked! ›</div>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </section>

  {#if d.total.classesStarted === 0}
    <div class="rounded-2xl p-10 text-center ring-1"
         style="background: var(--theme-card-bg); color: var(--theme-text-muted);
                --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
      You haven't watched anything yet — pick a lesson and stats will start filling in.
    </div>
  {/if}
{/if}

<StatsListModal
  open={modalOpen}
  title={modalCfg.title}
  subtitle={modalCfg.subtitle}
  source="stats"
  range={modalCfg.range}
  date={modalCfg.date}
  onClose={() => (modalOpen = false)}
/>
