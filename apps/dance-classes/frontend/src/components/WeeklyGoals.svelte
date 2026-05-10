<script lang="ts">
  import { onMount } from 'svelte';
  import StatsListModal from './StatsListModal.svelte';
  import { statsState, refreshStats } from '../lib/stores';

  // Subscribe to the shared statsState so any component that calls
  // refreshStats() (e.g. Watch.svelte after marking watched) updates
  // this banner instantly without us polling again.
  let data = $derived($statsState);
  let modalOpen = $state(false);
  let modalCfg = $state<{ title: string; subtitle: string; range: string }>({
    title: '', subtitle: '', range: 'this-week'
  });

  onMount(() => {
    void refreshStats();
    // Hourly enough — these stats only move when you watch a video.
    const t = setInterval(() => { void refreshStats(); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  });

  function open(title: string, subtitle: string, range: string) {
    modalCfg = { title, subtitle, range };
    modalOpen = true;
  }

  // Countdown to Sunday 23:59:59 used for the warning state.
  let now = $state(Date.now() / 1000);
  $effect(() => {
    const t = setInterval(() => { now = Date.now() / 1000; }, 60_000);
    return () => clearInterval(t);
  });
  function fmtCountdown(secsLeft: number): string {
    if (secsLeft < 0) return 'time';
    const h = Math.floor(secsLeft / 3600);
    const m = Math.floor((secsLeft % 3600) / 60);
    if (h < 1) return `${m}m`;
    if (h < 24) return `${h}h ${m}m`;
    return `${Math.ceil(h / 24)}d`;
  }

  let secsLeft = $derived(data ? Math.max(0, data.streak.endsAt - now) : 0);
  let videosGoalMet = $derived(!!data?.weekGoals.videos.met);
  let minutesGoalMet = $derived(!!data?.weekGoals.minutes.met);
  let bothMet = $derived(videosGoalMet && minutesGoalMet);
  let streakAtRisk = $derived(!!data?.streak.atRisk);
  let warnLevel = $derived<'none' | 'gentle' | 'urgent'>(
    streakAtRisk ? (secsLeft < 4 * 3600 ? 'urgent' : 'gentle') : 'none'
  );

  // Compose a "what's missing" string for the at-risk warning. Both targets
  // are now part of the streak rule, so list whichever isn't met.
  let needsCopy = $derived(((): string => {
    if (!data) return '';
    const parts: string[] = [];
    const v = data.weekGoals.videos;
    const m = data.weekGoals.minutes;
    if (!v.met) {
      const need = v.target - v.current;
      parts.push(need === 1 ? '1 more class' : `${need} more classes`);
    }
    if (!m.met) {
      const need = m.target - m.current;
      parts.push(`${need} more min`);
    }
    return parts.join(' + ');
  })());

  function ratioPct(cur: number, target: number): number {
    return Math.max(0, Math.min(100, Math.round((cur / target) * 100)));
  }
</script>

{#if data}
  {@const banner =
    warnLevel === 'urgent' ? 'background: rgba(244, 63, 94, 0.18); --tw-ring-color: rgba(244, 63, 94, 0.4); border-color: rgba(244, 63, 94, 0.4);' :
    warnLevel === 'gentle' ? 'background: rgba(251, 146, 60, 0.16); --tw-ring-color: rgba(251, 146, 60, 0.4); border-color: rgba(251, 146, 60, 0.4);' :
    bothMet                ? 'background: rgba(16, 185, 129, 0.14); --tw-ring-color: rgba(16, 185, 129, 0.4); border-color: rgba(16, 185, 129, 0.4);' :
    'background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);'
  }
  <div class="mb-4 rounded-2xl p-3 ring-1 sm:p-4" style={banner}>
    <!-- top line: streak + warning copy -->
    <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <div class="flex items-baseline gap-2">
        <span class="text-base">🔥</span>
        <span class="text-sm font-semibold" style="color: var(--theme-text-strong);">
          {data.streak.current}-week streak
        </span>
        <span class="text-[11px]" style="color: var(--theme-text-muted);">best {data.streak.longest}</span>
      </div>
      <div class="text-[11px] font-semibold uppercase tracking-wider"
           style="color: {warnLevel !== 'none' ? '#f43f5e' : (bothMet ? '#10b981' : 'var(--theme-text-muted)')};">
        {#if warnLevel === 'urgent'}
          ⚠️ {fmtCountdown(secsLeft)} left · need {needsCopy}
        {:else if warnLevel === 'gentle'}
          🕐 Sunday — need {needsCopy} to keep your streak
        {:else if bothMet}
          ✓ Streak alive — goals met
        {:else}
          Week ends Sunday · {fmtCountdown(secsLeft)} left
        {/if}
      </div>
    </div>

    <!-- the two goals, both clickable to drill down -->
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        type="button"
        class="rounded-xl p-2.5 text-left ring-1 transition"
        style="background: var(--theme-pill-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);"
        onclick={() => open('Videos this week', `1 class + 10 min keeps your streak`, 'this-week')}
      >
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--theme-text-muted);">📺 Videos this week</span>
          <span class="text-sm" style="color: {videosGoalMet ? '#10b981' : 'var(--theme-text-strong)'};">
            <strong>{data.weekGoals.videos.current}</strong> / {data.weekGoals.videos.target}{videosGoalMet ? ' ✓' : ''}
          </span>
        </div>
        <div class="mt-2 h-2 overflow-hidden rounded-full" style="background: var(--theme-card-ring);">
          <div class="h-full" style="width: {ratioPct(data.weekGoals.videos.current, data.weekGoals.videos.target)}%; background: {videosGoalMet ? '#10b981' : 'linear-gradient(90deg, var(--theme-accent), var(--theme-accent-2))'};"></div>
        </div>
      </button>

      <button
        type="button"
        class="rounded-xl p-2.5 text-left ring-1 transition"
        style="background: var(--theme-pill-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);"
        onclick={() => open('Minutes this week', `1 class + 10 min keeps your streak`, 'this-week')}
      >
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--theme-text-muted);">⏱️ Minutes this week</span>
          <span class="text-sm" style="color: {minutesGoalMet ? '#10b981' : 'var(--theme-text-strong)'};">
            <strong>{data.weekGoals.minutes.current}</strong> / {data.weekGoals.minutes.target}{minutesGoalMet ? ' ✓' : ''}
          </span>
        </div>
        <div class="mt-2 h-2 overflow-hidden rounded-full" style="background: var(--theme-card-ring);">
          <div class="h-full" style="width: {ratioPct(data.weekGoals.minutes.current, data.weekGoals.minutes.target)}%; background: {minutesGoalMet ? '#10b981' : 'linear-gradient(90deg, var(--theme-accent), var(--theme-accent-2))'};"></div>
        </div>
      </button>
    </div>
  </div>
{/if}

<StatsListModal
  open={modalOpen}
  title={modalCfg.title}
  subtitle={modalCfg.subtitle}
  source="stats"
  range={modalCfg.range}
  onClose={() => (modalOpen = false)}
/>
