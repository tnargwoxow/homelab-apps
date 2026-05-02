<script lang="ts">
  // Invisible glue component. Mounts once in App.svelte. Two responsibilities:
  //   1) Local auto-advance: when the local <video> ends, walk currentQueue
  //      forward and route the user to the next item.
  //   2) Drop the queue if the active cast disappears mid-queue (the cast
  //      side advances itself server-side; the local FE just observes).
  import { get } from 'svelte/store';
  import { push } from 'svelte-spa-router';
  import { currentLocalVideo } from '../lib/pip';
  import { activeCast } from '../lib/cast';
  import { currentQueue } from '../lib/queue';

  function onEnded() {
    const q = get(currentQueue);
    if (!q || q.items.length === 0) return;
    const next = q.index + 1;
    if (next >= q.items.length) return;
    currentQueue.set({ ...q, index: next });
    push(`/watch/${q.items[next].id}`);
  }

  // Wire the ended listener to whichever <video> is currently registered.
  $effect(() => {
    const v = $currentLocalVideo;
    if (!v) return;
    v.addEventListener('ended', onEnded);
    return () => v.removeEventListener('ended', onEnded);
  });

  // If we were casting a queue and the cast went away (network blip, the
  // user disconnected, etc.), don't keep a stale "queue in progress" pill.
  let hadActiveCast = $state(false);
  $effect(() => {
    const cast = $activeCast;
    if (cast?.session) {
      hadActiveCast = true;
    } else if (hadActiveCast) {
      hadActiveCast = false;
      const q = get(currentQueue);
      // Only clear if we're not also actively playing locally — otherwise
      // the local auto-advance hook above is still expected to drive it.
      const localV = get(currentLocalVideo);
      const localPlaying = !!localV && !localV.paused && !localV.ended;
      if (q && !localPlaying) {
        currentQueue.set(null);
      }
    }
  });
</script>
