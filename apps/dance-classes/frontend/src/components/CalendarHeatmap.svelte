<script lang="ts">
  interface Day { day: string; classes: number; seconds: number }
  interface Props {
    days: Day[];                       // chronological, oldest first
    onClickDay?: (date: string) => void;
  }
  let { days, onClickDay }: Props = $props();

  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WEEKDAY_LABELS = ['Mon','','Wed','','Fri','','']; // sparse to save space

  // Build a 7-row grid, padding with empty cells before the first day so
  // it lines up to its weekday. JS getDay(): Sun=0..Sat=6 — we want Mon=0.
  function dowMon0(iso: string): number {
    const d = new Date(iso + 'T00:00:00');
    return (d.getDay() + 6) % 7;
  }

  const grid = $derived.by(() => {
    if (days.length === 0) return { cols: 0, cells: [] as (Day | null)[][], firstDayOfMonthCols: [] as number[] };
    const padFront = dowMon0(days[0].day);
    // Total cells incl. front pad
    const total = padFront + days.length;
    const cols = Math.ceil(total / 7);
    const cells: (Day | null)[][] = Array.from({ length: 7 }, () => Array(cols).fill(null));
    for (let i = 0; i < days.length; i++) {
      const idx = padFront + i;
      const r = idx % 7;
      const c = Math.floor(idx / 7);
      cells[r][c] = days[i];
    }
    // First column where each month begins (for top labels).
    const firstDayOfMonthCols: number[] = Array(12).fill(-1);
    for (let i = 0; i < days.length; i++) {
      const d = new Date(days[i].day + 'T00:00:00');
      if (d.getDate() === 1) {
        const c = Math.floor((padFront + i) / 7);
        firstDayOfMonthCols[d.getMonth()] = c;
      }
    }
    return { cols, cells, firstDayOfMonthCols };
  });

  // Quartile thresholds based on non-zero days only — keeps the first
  // recorded session looking like a clear "1" rather than "barely there".
  const thresholds = $derived.by(() => {
    const ss = days.map(d => d.seconds).filter(s => s > 0).sort((a, b) => a - b);
    if (ss.length === 0) return [0, 0, 0, 0];
    const q = (p: number) => ss[Math.min(ss.length - 1, Math.max(0, Math.floor(p * ss.length)))];
    return [q(0.25), q(0.5), q(0.75), q(1.0)];
  });

  function bucket(seconds: number): 0 | 1 | 2 | 3 | 4 {
    if (seconds <= 0) return 0;
    const [q1, q2, q3] = thresholds;
    if (seconds <= q1) return 1;
    if (seconds <= q2) return 2;
    if (seconds <= q3) return 3;
    return 4;
  }

  // Mix-percentage for color-mix at each level. Empty squares use card-ring as a tint.
  const MIX_PCT = [0, 25, 50, 75, 100];

  function cellTitle(d: Day): string {
    const mins = Math.round(d.seconds / 60);
    if (mins === 0) return `${d.day} — no practice`;
    if (mins < 60) return `${d.day} — ${mins}m, ${d.classes} ${d.classes === 1 ? 'class' : 'classes'}`;
    const h = Math.floor(mins / 60);
    const r = mins % 60;
    return `${d.day} — ${r ? `${h}h ${r}m` : `${h}h`}, ${d.classes} ${d.classes === 1 ? 'class' : 'classes'}`;
  }
</script>

<div class="overflow-x-auto">
  <div class="inline-flex flex-col gap-1">
    <!-- Month labels row -->
    <div class="grid gap-[3px] text-[10px]"
         style={`grid-template-columns: 1.5rem repeat(${grid.cols}, 0.75rem); color: var(--theme-text-muted);`}>
      <div></div>
      {#each Array(grid.cols) as _, c (c)}
        {@const monthIdx = grid.firstDayOfMonthCols.findIndex(col => col === c)}
        <div class="text-[10px] leading-none">{monthIdx >= 0 ? MONTH_LABELS[monthIdx] : ''}</div>
      {/each}
    </div>

    <!-- Day grid: 7 rows × cols -->
    <div class="grid gap-[3px]"
         style={`grid-template-columns: 1.5rem repeat(${grid.cols}, 0.75rem); grid-template-rows: repeat(7, 0.75rem);`}>
      {#each grid.cells as row, r (r)}
        <div class="text-[10px] leading-[0.75rem]" style="color: var(--theme-text-muted);">
          {WEEKDAY_LABELS[r]}
        </div>
        {#each row as cell, c (c)}
          {#if cell}
            {@const b = bucket(cell.seconds)}
            <button
              type="button"
              class="h-3 w-3 rounded-[3px] transition hover:ring-2"
              style={b === 0
                ? `background: var(--theme-card-ring); --tw-ring-color: var(--theme-accent);`
                : `background: color-mix(in srgb, var(--theme-progress-from) ${MIX_PCT[b]}%, var(--theme-progress-to)); --tw-ring-color: var(--theme-accent);`}
              title={cellTitle(cell)}
              aria-label={cellTitle(cell)}
              onclick={() => onClickDay?.(cell.day)}
            ></button>
          {:else}
            <div></div>
          {/if}
        {/each}
      {/each}
    </div>

    <!-- Legend -->
    <div class="mt-1 flex items-center gap-1 text-[10px]" style="color: var(--theme-text-muted);">
      <span>Less</span>
      {#each [0,1,2,3,4] as b (b)}
        <span class="h-2.5 w-2.5 rounded-[2px]"
              style={b === 0
                ? `background: var(--theme-card-ring);`
                : `background: color-mix(in srgb, var(--theme-progress-from) ${MIX_PCT[b]}%, var(--theme-progress-to));`}></span>
      {/each}
      <span>More</span>
    </div>
  </div>
</div>
