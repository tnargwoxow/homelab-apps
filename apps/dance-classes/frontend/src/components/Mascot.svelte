<script lang="ts">
  import { theme } from '../lib/stores';
  import HeelsMascot from './HeelsMascot.svelte';
  import HipHopMascot from './HipHopMascot.svelte';
  import Squirtle from './Squirtle.svelte';
  import Mew from './Mew.svelte';

  interface Props {
    slot: 'left' | 'right';
    class?: string;
  }
  let { slot, class: cls = 'h-16 w-16' }: Props = $props();

  let failed = $state(false);

  // Reset failed state when theme changes (so a new theme gets a fresh attempt)
  let activeId = $derived($theme.id);
  $effect(() => {
    void activeId;
    failed = false;
  });

  let img = $derived(slot === 'left' ? $theme.mascotLeft : $theme.mascotRight);
</script>

{#if failed}
  {#if $theme.mascotKind === 'heels'}
    <HeelsMascot class={cls} />
  {:else if $theme.mascotKind === 'hiphop'}
    <HipHopMascot class={cls} />
  {:else if slot === 'left'}
    <Squirtle class={cls} />
  {:else}
    <Mew class={cls} />
  {/if}
{:else}
  <img
    src={img.src}
    alt={img.alt}
    loading="lazy"
    onerror={() => (failed = true)}
    class="select-none object-contain {cls}"
    draggable="false"
  />
{/if}
