<script lang="ts">
  interface Props {
    ratio: number;
  }
  let { ratio }: Props = $props();
  let pct = $derived(`${Math.max(0, Math.min(1, ratio)) * 100}%`);
</script>

<div class="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
  <div class="h-full bg-rose-500" style="width: {pct}"></div>
</div>
