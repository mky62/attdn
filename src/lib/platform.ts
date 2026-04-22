declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    window.__TAURI__ ||
    window.__TAURI_INTERNALS__ ||
    window.navigator.userAgent.includes('Tauri'),
  );
}
