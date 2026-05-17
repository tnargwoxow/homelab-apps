<script lang="ts">
  import { link } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import type { StatsListItem, LibraryErrorItem } from '../lib/api';
  import { formatDuration } from '../lib/format';

  interface Props {
    open: boolean;
    title: string;
    subtitle?: string;
    /** Either 'stats' (calls api.statsList) or 'errors' (calls api.libraryErrors) */
    source: 'stats' | 'errors';
    range?: string;
    date?: string;
    onClose: () => void;
  }
  let { open, title, subtitle = '', source, range = 'this-week', date, onClose }: Props = $props();

  let items = $state<StatsListItem[]>([]);
  let errorItems = $state<LibraryErrorItem[]>([]);
  let loading = $state(false);
  let fetchError = $state<string | null>(null);

  // Errors-mode state
  let showIgnored = $state(false);
  let busyIds = $state<Set<number>>(new Set());

  async function loadErrors() {
    loading = true;
    fetchError = null;
    try {
      const r = await api.libraryErrors(showIgnored);
      errorItems = r.items;
    } catch (e) { fetchError = (e as Error).message; }
    finally { loading = false; }
  }

  $effect(() => {
    if (!open) return;
    if (source === 'stats') {
      loading = true;
      fetchError = null;
      items = [];
      api.statsList(range, date)
        .then(r => { items = r.items; })
        .catch(e => { fetchError = (e as Error).message; })
        .finally(() => { loading = false; });
    } else {
      void loadErrors();
    }
  });

  async function withBusy(id: number, fn: () => Promise<unknown>) {
    if (busyIds.has(id)) return;
    busyIds = new Set(busyIds).add(id);
    try { await fn(); }
    catch (e) { fetchError = (e as Error).message; }
    finally {
      const next = new Set(busyIds); next.delete(id); busyIds = next;
    }
  }

  async function ignore(id: number) {
    await withBusy(id, async () => {
      await api.ignoreLibraryError(id);
      if (showIgnored) {
        // Item stays in the list, just flip its flag locally.
        errorItems = errorItems.map(e => e.id === id ? { ...e, ignored: true } : e);
      } else {
        errorItems = errorItems.filter(e => e.id !== id);
      }
    });
  }

  async function restore(id: number) {
    await withBusy(id, async () => {
      await api.restoreLibraryError(id);
      errorItems = errorItems.map(e => e.id === id ? { ...e, ignored: false } : e);
    });
  }

  async function retry(id: number) {
    await withBusy(id, async () => {
      await api.retryLibraryError(id);
      // It moves out of the errors set now; remove from view.
      errorItems = errorItems.filter(e => e.id !== id);
    });
  }

  function fmtRelative(unixSeconds: number): string {
    const diffMs = Date.now() - unixSeconds * 1000;
    const m = Math.round(diffMs / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
    onclick={onBackdrop}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl shadow-2xl ring-1 sm:h-[70vh] sm:rounded-3xl"
      style="background: var(--theme-pill-bg);
             --tw-ring-color: var(--theme-card-ring);
             border-color: var(--theme-card-ring);
             padding-bottom: env(safe-area-inset-bottom, 0);"
    >
      <div class="flex items-start justify-between gap-3 px-5 py-3" style="border-bottom: 1px solid var(--theme-card-ring);">
        <div class="min-w-0 flex-1">
          <div class="font-display text-xl" style="color: var(--theme-text-strong);">{title}</div>
          {#if subtitle}
            <div class="mt-0.5 text-xs" style="color: var(--theme-text-muted);">{subtitle}</div>
          {/if}
        </div>
        <button
          type="button"
          class="rounded-full px-2 py-1 text-sm"
          style="background: var(--theme-pill-bg); color: var(--theme-pill-text);"
          aria-label="Close"
          onclick={onClose}
        >✕</button>
      </div>

      {#if source === 'errors'}
        <div class="flex items-center justify-end gap-2 px-5 py-2 text-xs" style="border-bottom: 1px solid var(--theme-card-ring); color: var(--theme-text-muted);">
          <label class="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              bind:checked={showIgnored}
              onchange={() => loadErrors()}
              class="h-3.5 w-3.5"
            />
            Show ignored
          </label>
        </div>
      {/if}

      <div class="flex-1 overflow-y-auto">
        {#if loading}
          <div class="px-5 py-10 text-center" style="color: var(--theme-text-muted);">Loading…</div>
        {:else if fetchError}
          <div class="px-5 py-10 text-center" style="color: var(--theme-accent-2);">{fetchError}</div>
        {:else if source === 'stats'}
          {#if items.length === 0}
            <div class="px-5 py-10 text-center" style="color: var(--theme-text-muted);">Nothing to show here yet.</div>
          {:else}
            <ul>
              {#each items as it (it.id)}
                <li>
                  <a use:link href={`/watch/${it.id}`} class="flex items-center gap-3 px-4 py-3"
                     onclick={onClose}
                     style="border-bottom: 1px solid var(--theme-card-ring);"
                     onmouseover={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--theme-pill-hover)')}
                     onmouseout={(e)  => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}>
                    {#if it.hasThumb}
                      <img src={api.thumbUrl(it.id)} alt="" loading="lazy"
                           class="h-12 w-20 shrink-0 rounded-md object-cover ring-1"
                           style="--tw-ring-color: var(--theme-card-ring);" />
                    {:else}
                      <div class="h-12 w-20 shrink-0 rounded-md ring-1"
                           style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring);"></div>
                    {/if}
                    <div class="min-w-0 flex-1">
                      <div class="line-clamp-2 text-sm font-semibold" style="color: var(--theme-text-strong);">{it.title}</div>
                      <div class="mt-0.5 truncate text-[11px]" style="color: var(--theme-text-muted);">
                        {it.folderName}
                        {#if it.watched}<span class="ml-1" style="color: #10b981;">· ✓ watched</span>{/if}
                      </div>
                      <div class="mt-0.5 text-[10px]" style="color: var(--theme-text-muted);">
                        {formatDuration(it.position)} · {fmtRelative(it.updatedAt)}
                      </div>
                    </div>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          {#if errorItems.length === 0}
            <div class="px-5 py-10 text-center" style="color: var(--theme-text-muted);">
              {showIgnored ? 'No errors (ignored or otherwise). 🎉' : 'No active errors. 🎉'}
            </div>
          {:else}
            <ul>
              {#each errorItems as e (e.id)}
                <li class="px-4 py-3" style="border-bottom: 1px solid var(--theme-card-ring); opacity: {e.ignored ? 0.55 : 1};">
                  <div class="flex items-baseline gap-2">
                    {#if e.ignored}<span class="rounded-full px-1.5 py-0.5 text-[10px]" style="background: var(--theme-card-ring); color: var(--theme-text-muted);">IGNORED</span>{/if}
                    <span class="min-w-0 flex-1 text-sm font-semibold" style="color: var(--theme-text-strong); overflow-wrap: anywhere;">{e.title}</span>
                  </div>
                  <div class="mt-0.5 text-[11px]" style="color: var(--theme-text-muted); overflow-wrap: anywhere;">{e.relPath}</div>
                  {#if e.error}
                    <div class="mt-1.5 rounded-md p-2 text-[11px]"
                         style="background: rgba(244, 63, 94, 0.12); color: #f43f5e; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, monospace;">
                      {e.error}
                    </div>
                  {/if}
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    {#if e.ignored}
                      <button
                        type="button"
                        class="rounded-full px-3 py-1 text-xs ring-1 disabled:opacity-50"
                        style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
                        disabled={busyIds.has(e.id)}
                        onclick={() => restore(e.id)}
                      >Restore</button>
                    {:else}
                      <button
                        type="button"
                        class="rounded-full px-3 py-1 text-xs ring-1 disabled:opacity-50"
                        style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
                        disabled={busyIds.has(e.id)}
                        title="Hide this error"
                        onclick={() => ignore(e.id)}
                      >🙈 Ignore</button>
                    {/if}
                    <button
                      type="button"
                      class="rounded-full px-3 py-1 text-xs ring-1 disabled:opacity-50"
                      style="background: var(--theme-pill-bg); color: var(--theme-pill-text); --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
                      disabled={busyIds.has(e.id)}
                      title="Mark for re-scanning"
                      onclick={() => retry(e.id)}
                    >↻ Retry</button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
