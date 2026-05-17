<script lang="ts">
  interface Action {
    label: string;
    icon?: string;          // emoji or short symbol
    onSelect: () => void | Promise<void>;
    style?: 'default' | 'danger';
  }

  interface Props {
    open: boolean;
    title?: string;
    subtitle?: string;
    actions: Action[];
    onClose: () => void;
  }

  let { open, title = '', subtitle = '', actions, onClose }: Props = $props();

  async function handle(a: Action) {
    try { await a.onSelect(); }
    finally { onClose(); }
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') onClose();
  }
  $effect(() => {
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
    onclick={onBackdrop}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="w-full max-w-md overflow-hidden rounded-t-3xl shadow-2xl ring-1 sm:rounded-3xl"
      style="background: var(--theme-pill-bg);
             --tw-ring-color: var(--theme-card-ring);
             border-color: var(--theme-card-ring);
             padding-bottom: env(safe-area-inset-bottom, 0);"
    >
      {#if title || subtitle}
        <div class="px-5 py-3 text-center" style="border-bottom: 1px solid var(--theme-card-ring);">
          {#if title}
            <div class="line-clamp-2 text-sm font-semibold" style="color: var(--theme-text-strong);">{title}</div>
          {/if}
          {#if subtitle}
            <div class="mt-0.5 line-clamp-1 text-xs" style="color: var(--theme-text-muted);">{subtitle}</div>
          {/if}
        </div>
      {/if}

      <ul>
        {#each actions as a, i (i)}
          <li>
            <button
              type="button"
              class="flex w-full items-center gap-3 px-5 py-3.5 text-left text-base transition active:scale-[0.99]"
              style="color: {a.style === 'danger' ? '#f43f5e' : 'var(--theme-text)'}; border-top: {i === 0 ? 'none' : '1px solid var(--theme-card-ring)'};"
              onmouseover={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-pill-hover)')}
              onmouseout={(e)  => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
              onclick={() => handle(a)}
            >
              {#if a.icon}<span class="w-6 shrink-0 text-center text-lg">{a.icon}</span>{/if}
              <span class="flex-1">{a.label}</span>
            </button>
          </li>
        {/each}
      </ul>

      <button
        type="button"
        class="block w-full px-5 py-3.5 text-base font-medium"
        style="color: var(--theme-text-muted); border-top: 4px solid var(--theme-grad-1);"
        onclick={onClose}
      >Cancel</button>
    </div>
  </div>
{/if}
