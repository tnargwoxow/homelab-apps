<script lang="ts">
  interface Props { class?: string; }
  let { class: cls = 'h-6 w-6' }: Props = $props();
</script>

<svg viewBox="0 0 64 64" class={cls} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="bs-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fbcfe8"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <!-- shoe body -->
  <path d="M8 38 Q8 28 22 26 Q34 24 48 28 Q56 30 56 38 Q56 46 48 48 Q34 52 22 50 Q8 48 8 38 Z"
        fill="url(#bs-grad)" stroke="#9d174d" stroke-width="1.5"/>
  <!-- toe darker -->
  <ellipse cx="50" cy="38" rx="6" ry="7" fill="#be185d" opacity="0.5"/>
  <!-- ribbon laces -->
  <path d="M22 26 Q20 18 26 12" fill="none" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
  <path d="M28 26 Q34 16 42 18" fill="none" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
  <!-- bow -->
  <g transform="translate(26 14)">
    <ellipse cx="-4" cy="0" rx="4" ry="3" fill="#fb7185" stroke="#9d174d" stroke-width="1"/>
    <ellipse cx="4" cy="0" rx="4" ry="3" fill="#fb7185" stroke="#9d174d" stroke-width="1"/>
    <circle cx="0" cy="0" r="1.6" fill="#f43f5e"/>
  </g>
</svg>
