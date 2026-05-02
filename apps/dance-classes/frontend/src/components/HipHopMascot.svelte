<script lang="ts">
  interface Props { class?: string; }
  let { class: cls = 'h-16 w-16' }: Props = $props();
</script>

<svg viewBox="0 0 120 120" class={cls} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="hh-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#facc15"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <!-- spray-paint splat backdrop -->
  <circle cx="60" cy="60" r="46" fill="url(#hh-bg)" opacity="0.85"/>
  <circle cx="92" cy="32" r="6"  fill="#facc15" opacity="0.7"/>
  <circle cx="22" cy="92" r="5"  fill="#ef4444" opacity="0.7"/>
  <circle cx="100" cy="98" r="4" fill="#facc15" opacity="0.7"/>

  <!-- breakdancer silhouette (windmill pose) -->
  <g fill="#0a0a0a">
    <!-- torso -->
    <ellipse cx="60" cy="62" rx="22" ry="14" transform="rotate(-22 60 62)"/>
    <!-- head with cap -->
    <circle cx="40" cy="52" r="8"/>
    <path d="M30 50 L52 46 L52 50 Q42 53 30 52 Z" fill="#0a0a0a"/>
    <rect x="48" y="48" width="8" height="3" fill="#0a0a0a"/>
    <!-- planted arm -->
    <rect x="48" y="60" width="6" height="22" rx="2" transform="rotate(20 51 71)"/>
    <circle cx="58" cy="84" r="5"/>
    <!-- swung legs -->
    <rect x="68" y="48" width="22" height="6" rx="2" transform="rotate(-30 79 51)"/>
    <rect x="60" y="46" width="20" height="6" rx="2" transform="rotate(40 70 49)"/>
    <!-- free arm -->
    <rect x="38" y="56" width="20" height="5" rx="2" transform="rotate(-30 48 58)"/>
  </g>

  <!-- motion dashes -->
  <g stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" opacity="0.6">
    <line x1="20" y1="20" x2="32" y2="28"/>
    <line x1="28" y1="14" x2="34" y2="22"/>
    <line x1="100" y1="60" x2="112" y2="56"/>
  </g>
</svg>
