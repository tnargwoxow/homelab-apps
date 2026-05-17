<script lang="ts">
  interface Props {
    ratio: number;
  }
  let { ratio }: Props = $props();
  let pct = $derived(`${Math.max(0, Math.min(1, ratio)) * 100}%`);
</script>

<div class="absolute bottom-0 left-0 right-0 h-1.5" style="background: rgba(0,0,0,0.25);">
  <div class="h-full"
       style="width: {pct};
              background: linear-gradient(90deg, var(--theme-progress-from), var(--theme-progress-to));"></div>
</div>
