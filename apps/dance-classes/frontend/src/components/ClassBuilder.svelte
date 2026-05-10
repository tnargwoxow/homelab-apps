<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api';
  import { activeCast } from '../lib/cast';
  import { currentQueue, queueApi } from '../lib/queue';
  import { formatDuration } from '../lib/format';

  interface Props { open: boolean; onClose: () => void; }
  let { open, onClose }: Props = $props();

  // Save-as-playlist UI state — using an inline input rather than
  // window.prompt so the modal stays styled with the theme.
  let savingMode = $state<'idle' | 'naming' | 'busy'>('idle');
  let saveName = $state('');
  let saveError = $state<string | null>(null);

  let confirmClear = $state(false);

  function close() {
    savingMode = 'idle';
    saveName = '';
    saveError = null;
    confirmClear = false;
    onClose();
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function moveUp(i: number) {
    currentQueue.update(q => {
      if (!q || i <= 0) return q;
      const items = [...q.items];
      const [it] = items.splice(i, 1);
      items.splice(i - 1, 0, it);
      let idx = q.index;
      if (q.index === i) idx = i - 1;
      else if (q.index === i - 1) idx = i;
      return { ...q, items, index: idx };
    });
  }

  function moveDown(i: number) {
    currentQueue.update(q => {
      if (!q || i >= q.items.length - 1) return q;
      const items = [...q.items];
      const [it] = items.splice(i, 1);
      items.splice(i + 1, 0, it);
      let idx = q.index;
      if (q.index === i) idx = i + 1;
      else if (q.index === i + 1) idx = i;
      return { ...q, items, index: idx };
    });
  }

  function removeAt(i: number) {
    currentQueue.update(q => {
      if (!q) return q;
      const items = q.items.filter((_, j) => j !== i);
      if (items.length === 0) return null;
      let idx = q.index;
      if (i < q.index) idx -= 1;
      else if (i === q.index) idx = Math.min(q.index, items.length - 1);
      return { ...q, items, index: Math.max(0, idx) };
    });
  }

  async function saveAsPlaylist() {
    if (savingMode !== 'naming') {
      savingMode = 'naming';
      saveName = $currentQueue?.name ?? '';
      saveError = null;
      return;
    }
    const name = saveName.trim();
    if (!name) { saveError = 'Enter a name.'; return; }
    const q = $currentQueue;
    if (!q || q.items.length === 0) return;
    savingMode = 'busy';
    saveError = null;
    try {
      const created = await queueApi.create(name);
      for (const it of q.items) {
        await queueApi.appendItem(created.id, it.id);
      }
      currentQueue.update(qq => qq ? { ...qq, playlistId: created.id, name } : qq);
      savingMode = 'idle';
    } catch (err) {
      saveError = (err as Error).message ?? 'Save failed';
      savingMode = 'naming';
    }
  }

  function playNow() {
    const q = $currentQueue;
    if (!q || q.items.length === 0) return;
    currentQueue.update(qq => qq ? { ...qq, index: 0 } : qq);
    push(`/watch/${q.items[0].id}`);
    close();
  }

  let castBusy = $state(false);
  async function castQueue() {
    const q = $currentQueue;
    const dev = $activeCast;
    if (!q || !dev || q.items.length === 0) return;
    castBusy = true;
    try {
      await queueApi.castQueue(dev.id, q.items.map(i => i.id));
      close();
    } catch { /* ignore */ }
    finally { castBusy = false; }
  }

  function askClear() { confirmClear = true; }
  function doClear() {
    currentQueue.set(null);
    confirmClear = false;
    close();
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
      class="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-2xl ring-1 sm:rounded-3xl"
      style="background: var(--theme-pill-bg);
             --tw-ring-color: var(--theme-card-ring);
             border-color: var(--theme-card-ring);
             padding-bottom: env(safe-area-inset-bottom, 0);"
    >
      <!-- Header -->
      <div class="flex items-center gap-2 px-5 py-3" style="border-bottom: 1px solid var(--theme-card-ring);">
        <div class="min-w-0 flex-1">
          <div class="font-display text-lg leading-tight" style="color: var(--theme-text-strong);">
            📋 {$currentQueue?.name ?? 'Build a class'}
          </div>
          <div class="text-xs" style="color: var(--theme-text-muted);">
            {$currentQueue?.items.length ?? 0} videos in your queue
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          class="rounded-full px-3 py-1.5 text-sm"
          style="background: var(--theme-pill-hover); color: var(--theme-text);"
          onclick={close}
        >✕</button>
      </div>

      <!-- Items list -->
      <div class="flex-1 overflow-y-auto">
        {#if !$currentQueue || $currentQueue.items.length === 0}
          <div class="px-6 py-10 text-center text-sm" style="color: var(--theme-text-muted);">
            Long-press any video and pick "Add to current queue" to start building a class.
          </div>
        {:else}
          <ul class="divide-y" style="--tw-divide-opacity: 1; border-color: var(--theme-card-ring);">
            {#each $currentQueue.items as it, i (i + ':' + it.id)}
              <li class="flex items-center gap-2 px-3 py-2"
                  style={i === $currentQueue.index ? 'background: var(--theme-pill-hover);' : ''}>
                <div class="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg ring-1"
                     style="background: var(--theme-card-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring);">
                  {#if it.hasThumb}
                    <img src={api.thumbUrl(it.id)} alt="" loading="lazy" draggable="false"
                         class="absolute inset-0 h-full w-full object-cover" />
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="line-clamp-2 text-sm" style="color: var(--theme-text-strong);">
                    {#if it.episodeNum !== null}<span style="color: var(--theme-text-muted);">{it.episodeNum}.</span> {/if}{it.title}
                  </div>
                  <div class="text-xs" style="color: var(--theme-text-muted);">{formatDuration(it.durationSec)}</div>
                </div>
                <div class="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    class="rounded-full px-2 py-0.5 text-xs disabled:opacity-30"
                    style="background: var(--theme-pill-bg); color: var(--theme-text); border: 1px solid var(--theme-pill-ring);"
                    aria-label="Move up"
                    disabled={i === 0}
                    onclick={() => moveUp(i)}
                  >▲</button>
                  <button
                    type="button"
                    class="rounded-full px-2 py-0.5 text-xs disabled:opacity-30"
                    style="background: var(--theme-pill-bg); color: var(--theme-text); border: 1px solid var(--theme-pill-ring);"
                    aria-label="Move down"
                    disabled={i === $currentQueue.items.length - 1}
                    onclick={() => moveDown(i)}
                  >▼</button>
                </div>
                <button
                  type="button"
                  class="rounded-full px-2 py-1 text-xs"
                  style="color: #f43f5e;"
                  aria-label="Remove from queue"
                  onclick={() => removeAt(i)}
                >✕</button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Save name input -->
      {#if savingMode !== 'idle'}
        <div class="flex items-center gap-2 px-4 py-2" style="border-top: 1px solid var(--theme-card-ring);">
          <input
            type="text"
            class="flex-1 rounded-full px-3 py-1.5 text-sm outline-none ring-1"
            style="background: var(--theme-card-bg); color: var(--theme-text);
                   --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
            placeholder="Class name…"
            bind:value={saveName}
            disabled={savingMode === 'busy'}
          />
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-sm font-semibold text-white"
            style="background: linear-gradient(90deg, var(--theme-accent), var(--theme-accent-2));"
            onclick={saveAsPlaylist}
            disabled={savingMode === 'busy'}
          >{savingMode === 'busy' ? '…' : 'Save'}</button>
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-sm"
            style="color: var(--theme-text-muted);"
            onclick={() => { savingMode = 'idle'; saveError = null; }}
          >Cancel</button>
        </div>
        {#if saveError}
          <div class="px-4 pb-2 text-xs" style="color: #f43f5e;">{saveError}</div>
        {/if}
      {/if}

      <!-- Confirm clear -->
      {#if confirmClear}
        <div class="flex items-center gap-2 px-4 py-2" style="border-top: 1px solid var(--theme-card-ring);">
          <span class="flex-1 text-sm" style="color: var(--theme-text);">Clear this queue?</span>
          <button class="rounded-full px-3 py-1.5 text-sm font-semibold text-white"
                  style="background: #f43f5e;"
                  onclick={doClear}>Clear</button>
          <button class="rounded-full px-3 py-1.5 text-sm"
                  style="color: var(--theme-text-muted);"
                  onclick={() => (confirmClear = false)}>Keep</button>
        </div>
      {/if}

      <!-- Bottom actions -->
      <div class="grid grid-cols-2 gap-2 p-3 text-sm" style="border-top: 1px solid var(--theme-card-ring);">
        <button
          type="button"
          class="rounded-full px-3 py-2 font-semibold"
          style="background: var(--theme-pill-hover); color: var(--theme-text-strong);"
          disabled={!$currentQueue || $currentQueue.items.length === 0 || savingMode === 'busy'}
          onclick={saveAsPlaylist}
        >💾 Save as playlist</button>

        <button
          type="button"
          class="rounded-full px-3 py-2 font-semibold text-white"
          style="background: linear-gradient(90deg, var(--theme-accent), var(--theme-accent-2));"
          disabled={!$currentQueue || $currentQueue.items.length === 0}
          onclick={playNow}
        >▶ Play now</button>

        <button
          type="button"
          class="rounded-full px-3 py-2 font-semibold disabled:opacity-50"
          style="background: var(--theme-pill-hover); color: var(--theme-text-strong);"
          disabled={!$activeCast?.id || !$currentQueue || $currentQueue.items.length === 0 || castBusy}
          onclick={castQueue}
        >📺 Cast queue{castBusy ? '…' : ''}</button>

        <button
          type="button"
          class="rounded-full px-3 py-2 font-semibold"
          style="background: var(--theme-pill-bg); color: #f43f5e; border: 1px solid var(--theme-pill-ring);"
          disabled={!$currentQueue || $currentQueue.items.length === 0}
          onclick={askClear}
        >🗑 Clear queue</button>
      </div>
    </div>
  </div>
{/if}
