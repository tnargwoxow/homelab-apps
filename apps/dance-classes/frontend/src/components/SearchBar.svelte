<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { theme } from '../lib/stores';

  interface Props {
    initial?: string;
  }
  let { initial = '' }: Props = $props();
  let value = $state(initial);

  // Debounce the route push so the URL doesn't churn on every keystroke
  // (which on some Android browsers — Samsung Internet in particular —
  // re-renders the input mid-keystroke, snaps the caret to position 0,
  // and makes typing appear "backwards").
  let pushTimer: ReturnType<typeof setTimeout> | null = null;

  function schedulePush(q: string) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      if (q.length >= 2) push(`/search?q=${encodeURIComponent(q)}`);
    }, 250);
  }

  function onSubmit(e: Event) {
    e.preventDefault();
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    const q = value.trim();
    if (q) push(`/search?q=${encodeURIComponent(q)}`);
  }

  // No bind:value — keep the input as the source of truth for what's being
  // typed and only mirror it back into local state. Setting the input's
  // value programmatically while the user types is what was knocking the
  // caret around on Android.
  function onInput(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    value = v;
    schedulePush(v.trim());
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
      value={value}
      oninput={onInput}
      placeholder={$theme.search.placeholder}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      class="w-full rounded-full py-2.5 pl-10 pr-4 text-sm outline-none ring-1"
      style="background: var(--theme-pill-bg);
             color: var(--theme-text);
             --tw-ring-color: var(--theme-pill-ring);
             border-color: var(--theme-pill-ring);"
    />
  </div>
</form>
