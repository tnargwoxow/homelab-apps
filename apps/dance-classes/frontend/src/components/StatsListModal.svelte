<script lang="ts">
  import { link } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import type { StatsListItem } from '../lib/api';
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
  let errorItems = $state<{ id: number; title: string; error: string | null; relPath: string }[]>([]);
  let loading = $state(false);
  let fetchError = $state<string | null>(null);

  $effect(() => {
    if (!open) return;
    loading = true;
    fetchError = null;
    items = [];
    errorItems = [];
    if (source === 'stats') {
      api.statsList(range, date)
        .then(r => { items = r.items; })
        .catch(e => { fetchError = (e as Error).message; })
        .finally(() => { loading = false; });
    } else {
      api.libraryErrors()
        .then(r => { errorItems = r.items.map(i => ({ id: i.id, title: i.title || i.filename, error: i.error, relPath: i.relPath })); })
        .catch(e => { fetchError = (e as Error).message; })
        .finally(() => { loading = false; });
    }
  });

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
            <div class="px-5 py-10 text-center" style="color: var(--theme-text-muted);">No errors. 🎉</div>
          {:else}
            <ul>
              {#each errorItems as e (e.id)}
                <li class="px-4 py-3" style="border-bottom: 1px solid var(--theme-card-ring);">
                  <div class="text-sm font-semibold" style="color: var(--theme-text-strong); overflow-wrap: anywhere;">{e.title}</div>
                  <div class="mt-0.5 text-[11px]" style="color: var(--theme-text-muted); overflow-wrap: anywhere;">{e.relPath}</div>
                  {#if e.error}
                    <div class="mt-1.5 rounded-md p-2 text-[11px]"
                         style="background: rgba(244, 63, 94, 0.12); color: #f43f5e; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, monospace;">
                      {e.error}
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
