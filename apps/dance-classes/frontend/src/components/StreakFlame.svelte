<script lang="ts">
  interface Props {
    days: number;
    size?: 'sm' | 'md' | 'lg';
    atRisk?: boolean;
  }
  let { days, size = 'md', atRisk = false }: Props = $props();

  const dim = $derived(size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-14 w-14' : 'h-8 w-8');
  const fontSize = $derived(size === 'sm' ? 13 : size === 'lg' ? 16 : 14);
  // Cap visible label to keep it readable; 99+ feels right.
  const label = $derived(days >= 100 ? '99+' : String(days));
  const animClass = $derived(atRisk ? 'streak-flame-ember' : 'streak-flame-flicker');
</script>

<svg viewBox="0 0 32 36" class={`${dim} inline-block align-middle`} aria-label={`${days}-day streak`}>
  <defs>
    <linearGradient id="streak-flame-outer" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%"   stop-color="#dc2626" />
      <stop offset="55%"  stop-color="#f97316" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>
    <linearGradient id="streak-flame-inner" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%"   stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#fef08a" />
    </linearGradient>
  </defs>
  <g class={animClass}>
    <!-- outer flame -->
    <path d="M16 2 C 12 8 8 11 8 18 C 8 25 12 32 16 32 C 20 32 24 25 24 18 C 24 14 21 11 19 7 C 18 9 17 10 16 10 C 16 7 16 4 16 2 Z"
          fill="url(#streak-flame-outer)" />
    <!-- inner core -->
    <path d="M16 14 C 13 17 12 20 12 24 C 12 28 14 31 16 31 C 18 31 20 28 20 24 C 20 21 18 18 16 14 Z"
          fill="url(#streak-flame-inner)" opacity="0.95" />
  </g>
  <text x="16" y="26" text-anchor="middle"
        font-family="system-ui,sans-serif"
        font-size={fontSize}
        font-weight="800"
        fill="#7c2d12"
        style="paint-order: stroke; stroke: rgba(255,255,255,0.7); stroke-width: 0.6;">{label}</text>
</svg>
