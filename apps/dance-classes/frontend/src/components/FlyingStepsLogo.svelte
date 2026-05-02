<script lang="ts">
  interface Props { class?: string; }
  let { class: cls = 'h-8' }: Props = $props();
</script>

<!--
  Flying Steps Academy wordmark, recreated from the studio's branding
  (Berlin). Stark white "FLYING" + crimson red "STEPS" with the
  signature condensed-uppercase block letters that match their logo.
-->
<svg viewBox="0 0 280 60" class={cls} xmlns="http://www.w3.org/2000/svg" aria-label="Flying Steps Academy">
  <text
    x="6"
    y="46"
    fill="#ffffff"
    font-family="'Bebas Neue', 'Anton', 'Impact', sans-serif"
    font-size="48"
    font-weight="700"
    letter-spacing="2"
  >FLYING</text>
  <text
    x="148"
    y="46"
    fill="#e30613"
    font-family="'Bebas Neue', 'Anton', 'Impact', sans-serif"
    font-size="48"
    font-weight="700"
    letter-spacing="2"
  >STEPS</text>
  <!-- accent diamond between words -->
  <rect x="138" y="22" width="6" height="6" transform="rotate(45 141 25)" fill="#e30613"/>
</svg>
