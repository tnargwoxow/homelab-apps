<script lang="ts">
  import { celebrationPulses } from '../lib/celebrate';

  // Each pulse spawns a fixed batch of sparks at random angles. The component
  // tree mirrors the store array so when a pulse is removed the sparks unmount
  // cleanly (CSS animation drives the visual lifetime; we just match it).

  function buildSparks(level: 'small' | 'big') {
    const count = level === 'big' ? 24 : 12;
    const radius = level === 'big' ? 220 : 140;
    const out: Array<{ dx: number; dy: number; rotate: number; hue: string; delay: number }> = [];
    const palette = ['#fbbf24', '#f97316', '#f472b6', '#a78bfa', '#fde047', '#fb7185'];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const r = radius * (0.6 + Math.random() * 0.4);
      out.push({
        dx: Math.cos(angle) * r,
        dy: Math.sin(angle) * r,
        rotate: (i * 30) % 360,
        hue: palette[i % palette.length],
        delay: Math.random() * 0.15
      });
    }
    return out;
  }
</script>

<div class="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
  {#each $celebrationPulses as pulse (pulse.id)}
    {@const sparks = buildSparks(pulse.level)}
    <div class="absolute left-1/2 top-1/2">
      {#each sparks as s, i (i)}
        <svg viewBox="0 0 24 24"
             class="celebrate-spark absolute"
             style="--dx: {s.dx}px;
                    --dy: {s.dy}px;
                    width: {pulse.level === 'big' ? 28 : 22}px;
                    height: {pulse.level === 'big' ? 28 : 22}px;
                    color: {s.hue};
                    transform: rotate({s.rotate}deg);
                    animation-delay: {s.delay}s;">
          <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" fill="currentColor" />
        </svg>
      {/each}
    </div>
  {/each}
</div>
