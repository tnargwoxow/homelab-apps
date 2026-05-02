<script lang="ts">
  interface Props { class?: string; }
  let { class: cls = 'h-4 w-4' }: Props = $props();
</script>

<svg viewBox="0 0 24 24" class={cls} fill="currentColor" aria-hidden="true">
  <path d="M12 2 L13.8 9.2 L21 11 L13.8 12.8 L12 20 L10.2 12.8 L3 11 L10.2 9.2 Z"/>
</svg>
