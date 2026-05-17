<script lang="ts">
  interface Props { class?: string; }
  let { class: cls = 'h-16 w-16' }: Props = $props();
</script>

<svg viewBox="0 0 120 120" class={cls} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="fs-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#1a0a0a"/>
      <stop offset="100%" stop-color="#0a0000"/>
    </linearGradient>
  </defs>
  <!-- circular badge backdrop in Flying Steps black -->
  <circle cx="60" cy="60" r="54" fill="url(#fs-bg)" stroke="#e30613" stroke-width="3"/>
  <!-- inner ring -->
  <circle cx="60" cy="60" r="46" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.25"/>

  <!-- breakdancer silhouette in white (windmill freeze, slowly spinning) -->
  <g class="hiphop-spin">
    <g fill="#ffffff">
      <!-- torso -->
      <ellipse cx="60" cy="62" rx="22" ry="13" transform="rotate(-22 60 62)"/>
      <!-- head with cap -->
      <circle cx="40" cy="52" r="8"/>
      <path d="M30 50 L52 46 L52 50 Q42 53 30 52 Z"/>
      <rect x="48" y="48" width="8" height="3"/>
      <!-- planted arm -->
      <rect x="48" y="60" width="6" height="22" rx="2" transform="rotate(20 51 71)"/>
      <circle cx="58" cy="84" r="5"/>
      <!-- legs -->
      <rect x="68" y="48" width="22" height="6" rx="2" transform="rotate(-30 79 51)"/>
      <rect x="60" y="46" width="20" height="6" rx="2" transform="rotate(40 70 49)"/>
      <!-- free arm -->
      <rect x="38" y="56" width="20" height="5" rx="2" transform="rotate(-30 48 58)"/>
    </g>
  </g>

  <!-- red accent stripes (Flying Steps signature) -->
  <g stroke="#e30613" stroke-width="3" stroke-linecap="square">
    <line x1="14" y1="60" x2="22" y2="60"/>
    <line x1="98" y1="60" x2="106" y2="60"/>
  </g>

  <!-- motion dashes -->
  <g stroke="#e30613" stroke-width="2" stroke-linecap="round" opacity="0.85">
    <line x1="20" y1="20" x2="32" y2="28"/>
    <line x1="28" y1="14" x2="34" y2="22"/>
    <line x1="100" y1="98" x2="92" y2="92"/>
  </g>
</svg>
