<script lang="ts">
  // Mounts globally (in App.svelte). Whenever a celebrate() pulse fires,
  // we swing the active theme's mascot in from off-screen, let them do a
  // little jig, then send them sailing back out. A second pulse while the
  // first is still on screen retriggers the animation cleanly because the
  // {#each} key is the pulse id, so each pulse mounts its own mascot.

  import { celebrationPulses } from '../lib/celebrate';
  import Mascot from './Mascot.svelte';

  // Swap left/right entrances per pulse so consecutive celebrations don't
  // come from the same direction.
  function pickSide(id: number): 'left' | 'right' {
    return id % 2 === 0 ? 'right' : 'left';
  }
  function pickSlot(id: number): 'left' | 'right' {
    // Use the opposite slot of the entry side so the mascot is "facing in".
    return id % 2 === 0 ? 'left' : 'right';
  }
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-20 z-[55] flex justify-center" aria-hidden="true">
  {#each $celebrationPulses as pulse (pulse.id)}
    {@const side = pickSide(pulse.id)}
    <div class="absolute bottom-0 mascot-swoop"
         class:from-left={side === 'left'}
         class:from-right={side === 'right'}>
      <Mascot slot={pickSlot(pulse.id)} class={pulse.level === 'big' ? 'h-32 w-32' : 'h-24 w-24'} />
    </div>
  {/each}
</div>

<style>
  /* Slide in from below+side, do a wiggle in place, then sail off
     the opposite way. 1.6s matches the celebrate-pulse lifetime so the
     element unmounts right as it leaves the viewport. */
  @keyframes mascot-swoop-right {
    0%   { transform: translate(80vw, 30vh) rotate(-25deg); opacity: 0; }
    20%  { transform: translate(0, 0)        rotate(0deg);   opacity: 1; }
    40%  { transform: translate(-12px, -8px) rotate(8deg);   opacity: 1; }
    60%  { transform: translate(8px, -4px)   rotate(-6deg);  opacity: 1; }
    80%  { transform: translate(0, -12px)    rotate(2deg);   opacity: 1; }
    100% { transform: translate(-90vw, -40vh) rotate(20deg); opacity: 0; }
  }
  @keyframes mascot-swoop-left {
    0%   { transform: translate(-80vw, 30vh) rotate(25deg);  opacity: 0; }
    20%  { transform: translate(0, 0)        rotate(0deg);   opacity: 1; }
    40%  { transform: translate(12px, -8px)  rotate(-8deg);  opacity: 1; }
    60%  { transform: translate(-8px, -4px)  rotate(6deg);   opacity: 1; }
    80%  { transform: translate(0, -12px)    rotate(-2deg);  opacity: 1; }
    100% { transform: translate(90vw, -40vh) rotate(-20deg); opacity: 0; }
  }
  .mascot-swoop.from-right { animation: mascot-swoop-right 1.6s cubic-bezier(.2,.8,.2,1) forwards; }
  .mascot-swoop.from-left  { animation: mascot-swoop-left  1.6s cubic-bezier(.2,.8,.2,1) forwards; }

  @media (prefers-reduced-motion: reduce) {
    .mascot-swoop.from-right,
    .mascot-swoop.from-left { animation: none; opacity: 0; }
  }
</style>
