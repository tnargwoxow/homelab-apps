<script lang="ts">
  import { installAvailable, installed, triggerInstall, detectBrowser } from '../lib/pwa';

  let showHelp = $state(false);

  async function onClick() {
    // Try the native prompt first; fall back to manual instructions.
    const ok = await triggerInstall();
    if (!ok) showHelp = true;
  }

  function close() { showHelp = false; }

  let kind = $derived(detectBrowser());
</script>

{#if !$installed}
  <button
    type="button"
    class="rounded-full px-3 py-1.5 text-sm shadow-sm ring-1 transition"
    style="background: var(--theme-pill-bg); color: var(--theme-pill-text);
           --tw-ring-color: var(--theme-pill-ring); border-color: var(--theme-pill-ring);"
    aria-label="Install app"
    title={$installAvailable ? 'Install Mimi as an app' : 'How to add to your home screen'}
    onclick={onClick}
  >
    📲<span class="ml-1 hidden sm:inline">Install</span>
  </button>
{/if}

{#if showHelp}
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
    onclick={(e) => { if (e.target === e.currentTarget) close(); }}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="w-full max-w-md overflow-hidden rounded-t-3xl shadow-2xl ring-1 sm:rounded-3xl"
      style="background: var(--theme-pill-bg); --tw-ring-color: var(--theme-card-ring); border-color: var(--theme-card-ring); padding-bottom: env(safe-area-inset-bottom, 0);"
    >
      <div class="px-5 py-4" style="border-bottom: 1px solid var(--theme-card-ring);">
        <div class="font-display text-xl" style="color: var(--theme-text-strong);">📲 Add to your home screen</div>
        <p class="mt-1 text-xs" style="color: var(--theme-text-muted);">
          Your browser only auto-prompts to install over HTTPS. On the local network you can still add it manually — it'll work the same.
        </p>
      </div>

      <div class="px-5 py-4 text-sm leading-relaxed" style="color: var(--theme-text);">
        {#if kind === 'samsung'}
          <ol class="ml-5 list-decimal space-y-1.5">
            <li>Tap the <b>menu</b> button (≡) bottom right.</li>
            <li>Tap <b>Add page to</b>.</li>
            <li>Tap <b>Home screen</b>.</li>
            <li>Confirm <b>Add</b>.</li>
          </ol>
        {:else if kind === 'chrome-android'}
          <ol class="ml-5 list-decimal space-y-1.5">
            <li>Tap the <b>⋮</b> menu top right.</li>
            <li>Tap <b>Add to Home screen</b> (or <b>Install app</b> if shown).</li>
            <li>Confirm <b>Add</b>.</li>
          </ol>
        {:else if kind === 'safari-ios'}
          <ol class="ml-5 list-decimal space-y-1.5">
            <li>Tap the <b>Share</b> button (□↑) at the bottom.</li>
            <li>Scroll and tap <b>Add to Home Screen</b>.</li>
            <li>Confirm <b>Add</b>.</li>
          </ol>
        {:else if kind === 'firefox'}
          <ol class="ml-5 list-decimal space-y-1.5">
            <li>Tap the <b>⋮</b> menu.</li>
            <li>Tap <b>Install</b> or <b>Add to Home Screen</b>.</li>
          </ol>
          <p class="mt-2 text-xs" style="color: var(--theme-text-muted);">
            Firefox's PWA support is limited; the bookmark will still open in the browser.
          </p>
        {:else if kind === 'chrome-desktop'}
          <ol class="ml-5 list-decimal space-y-1.5">
            <li>Click the <b>install icon</b> (⊕ or 📲) in the address bar, or</li>
            <li>Open the <b>⋮</b> menu and choose <b>Install Mimi…</b></li>
          </ol>
        {:else}
          <p>Look for an <b>Install</b> or <b>Add to Home Screen</b> option in your browser's menu.</p>
        {/if}

        <p class="mt-3 text-xs" style="color: var(--theme-text-muted);">
          Tip: if you set up an HTTPS reverse proxy in front of the server later, your browser's automatic install prompt will start working too.
        </p>
      </div>

      <button
        type="button"
        class="block w-full px-5 py-3.5 text-base font-medium"
        style="color: var(--theme-text-muted); border-top: 4px solid var(--theme-grad-1);"
        onclick={close}
      >Got it</button>
    </div>
  </div>
{/if}
