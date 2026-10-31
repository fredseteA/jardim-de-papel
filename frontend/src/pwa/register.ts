/** Updates wait for old app windows to close: never reload a child's reading. */
export function registerPwa() {
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  const register = () => { void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
    // The online application remains usable if the browser denies registration.
  }); };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
