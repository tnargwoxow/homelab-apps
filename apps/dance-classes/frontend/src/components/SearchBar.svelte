<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { theme } from '../lib/stores';

  interface Props {
    initial?: string;
  }
  let { initial = '' }: Props = $props();
  let value = $state(initial);

  function onSubmit(e: Event) {
    e.preventDefault();
    const q = value.trim();
    if (q) push(`/search?q=${encodeURIComponent(q)}`);
  }

  function onInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    const q = value.trim();
    if (q.length >= 2) push(`/search?q=${encodeURIComponent(q)}`);
  }
</script>

<form onsubmit={onSubmit} class="flex w-full items-center gap-2">
  <div class="relative flex-1">
    <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
         style="color: var(--theme-text-muted);"
         fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
    </svg>
    <input
      type="search"
      bind:value
      oninput={onInput}
      placeholder={$theme.search.placeholder}
      class="w-full rounded-full py-2.5 pl-10 pr-4 text-sm outline-none ring-1"
      style="background: var(--theme-pill-bg);
             color: var(--theme-text);
             --tw-ring-color: var(--theme-pill-ring);
             border-color: var(--theme-pill-ring);"
    />
  </div>
</form>
