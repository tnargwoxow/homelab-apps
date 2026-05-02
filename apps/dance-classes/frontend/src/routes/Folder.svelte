<script lang="ts">
  import { api } from '../lib/api';
  import type { FolderPayload } from '../lib/api';
  import Breadcrumb from '../components/Breadcrumb.svelte';
  import VideoCard from '../components/VideoCard.svelte';
  import FolderCard from '../components/FolderCard.svelte';

  interface Props { params?: { id?: string }; }
  let { params }: Props = $props();

  let payload = $state<FolderPayload | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    const id = Number.parseInt(params?.id ?? '', 10);
    if (!Number.isFinite(id)) {
      error = 'Bad folder id';
      loading = false;
      return;
    }
    loading = true;
    error = null;
    payload = null;
    api.folder(id)
      .then(p => { payload = p; })
      .catch(e => { error = (e as Error).message; })
      .finally(() => { loading = false; });
  });
</script>

{#if loading}
  <div class="py-20 text-center text-fuchsia-500">Loading…</div>
{:else if error}
  <div class="py-10 text-center text-rose-500">{error}</div>
{:else if payload}
  <div class="mb-6">
    <Breadcrumb items={payload.breadcrumb} />
    <h1 class="mt-2 font-display text-3xl text-fuchsia-700 sm:text-4xl">{payload.folder.name}</h1>
  </div>

  {#if payload.folders.length > 0}
    <section class="mb-8">
      <h2 class="mb-3 text-xs font-bold uppercase tracking-wider text-fuchsia-500">Sub-folders</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each payload.folders as f (f.id)}
          <FolderCard id={f.id} name={f.name} childCount={f.childCount} thumbVideoIds={f.thumbVideoIds} />
        {/each}
      </div>
    </section>
  {/if}

  {#if payload.videos.length > 0}
    <section>
      <h2 class="mb-3 text-xs font-bold uppercase tracking-wider text-fuchsia-500">Videos ({payload.videos.length})</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each payload.videos as v (v.id)}
          <VideoCard
            id={v.id}
            title={v.title}
            durationSec={v.durationSec}
            hasThumb={v.hasThumb}
            position={v.position}
            watched={v.watched}
            favorite={v.favorite}
            episodeNum={v.episodeNum}
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if payload.folders.length === 0 && payload.videos.length === 0}
    <div class="rounded-2xl bg-white/70 p-10 text-center text-fuchsia-700/80 ring-1 ring-pink-200">This folder is empty.</div>
  {/if}
{/if}
