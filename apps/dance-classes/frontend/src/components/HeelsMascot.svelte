<script lang="ts">
  interface Props { class?: string; }
  let { class: cls = 'h-16 w-16' }: Props = $props();
</script>

<svg viewBox="0 0 120 120" class={cls} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="hl-shoe" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
    <radialGradient id="hl-flame" cx="50%" cy="60%" r="60%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="60%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#7f1d1d"/>
    </radialGradient>
  </defs>
  <!-- flame backdrop -->
  <path d="M60 16 Q44 30 48 50 Q40 56 44 70 Q36 80 50 92 Q60 100 70 92 Q84 80 76 70 Q80 56 72 50 Q76 30 60 16 Z"
        fill="url(#hl-flame)" opacity="0.9"/>
  <!-- stiletto -->
  <g transform="translate(20 70) rotate(-8)">
    <path d="M0 18 Q4 8 30 6 Q60 4 76 8 Q82 10 76 18 L72 22 Q56 26 36 24 Q14 22 0 18 Z"
          fill="url(#hl-shoe)" stroke="#3b0764" stroke-width="1.5"/>
    <path d="M70 22 L82 60 L78 62 L66 24 Z" fill="#1f0010" stroke="#3b0764" stroke-width="1.2"/>
    <path d="M2 18 Q-6 12 8 6" fill="none" stroke="#fbbf24" stroke-width="1.5"/>
  </g>
  <!-- twinkle -->
  <path d="M96 22 L99 30 L107 32 L99 34 L96 42 L93 34 L85 32 L93 30 Z" fill="#fde047"/>
</svg>
