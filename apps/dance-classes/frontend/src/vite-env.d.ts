/// <reference types="svelte" />
/// <reference types="vite/client" />

// Injected by Vite's `define` at build time. Used in the footer so the
// device shows which build it's actually running — handy when the PWA
// service worker has cached a stale version.
declare const __APP_BUILD__: string;
