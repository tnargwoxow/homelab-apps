<script lang="ts">
  interface Props {
    ratio: number;
  }
  let { ratio }: Props = $props();
  let pct = $derived(`${Math.max(0, Math.min(1, ratio)) * 100}%`);
</script>

<div class="absolute bottom-0 left-0 right-0 h-1.5 bg-white/40">
  <div class="h-full bg-gradient-to-r from-pink-400 to-fuchsia-500" style="width: {pct}"></div>
</div>
