// Svelte action: detect a long press (touch hold or mouse hold) and fire a
// callback. Critically, also suppress the click that pointerup synthesizes
// after the long press — otherwise the underlying <a> would still navigate.
//
// Usage:
//   <div use:longpress={{ onLongPress: () => openMenu() }}>...</div>

export interface LongPressOptions {
  onLongPress: () => void;
  thresholdMs?: number;     // default 500ms
  moveTolerancePx?: number; // default 10px
}

export function longpress(node: HTMLElement, options: LongPressOptions) {
  let opts = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  let startX = 0;
  let startY = 0;
  let triggered = false;
  let suppressUntil = 0;

  function start(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active = true;
    triggered = false;
    startX = e.clientX;
    startY = e.clientY;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!active) return;
      triggered = true;
      // The trailing click after pointerup will arrive within ~500ms; gate
      // any clicks during this window so the anchor doesn't navigate.
      suppressUntil = Date.now() + 800;
      // Fire haptic feedback if the device supports it.
      try { navigator.vibrate?.(15); } catch { /* ignore */ }
      opts.onLongPress();
    }, opts.thresholdMs ?? 500);
  }

  function move(e: PointerEvent) {
    if (!active) return;
    const tol = opts.moveTolerancePx ?? 10;
    if (Math.abs(e.clientX - startX) > tol || Math.abs(e.clientY - startY) > tol) {
      cancel();
    }
  }

  function cancel() {
    active = false;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  // Capture-phase click handler: runs before svelte-spa-router's bubble-phase
  // listener, so we can suppress the click that follows a long-press.
  function clickGuard(e: MouseEvent) {
    if (Date.now() < suppressUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      // One-shot: clear the window after firing once, to avoid swallowing
      // a deliberate click that races our timer.
      suppressUntil = 0;
    }
    void triggered; // silence unused-var warning when we don't read it
  }

  function onContextMenu(e: Event) {
    // Stop iOS / desktop right-click context menu from popping over our sheet.
    e.preventDefault();
  }

  node.addEventListener('pointerdown', start);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('pointerleave', cancel);
  // Capture phase so we run BEFORE the anchor's listener.
  node.addEventListener('click', clickGuard, true);
  node.addEventListener('contextmenu', onContextMenu);

  return {
    update(next: LongPressOptions) { opts = next; },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', start);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('pointerleave', cancel);
      node.removeEventListener('click', clickGuard, true);
      node.removeEventListener('contextmenu', onContextMenu);
    }
  };
}
