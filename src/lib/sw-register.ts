/**
 * Register the service worker, and get off a stale build when one is replaced.
 *
 * The worker that shipped before this one served the previous build on every
 * fresh open, so fixes looked like they had never happened. Replacing it is not
 * enough on its own: the visit that installs the replacement is still served by
 * the old worker, so without this the old app would show one last time.
 *
 * Deliberately plain: no imports, no TypeScript-only syntax, so the browser
 * check in scripts/sw-check.mjs can run this exact source rather than a copy of
 * it that is free to drift.
 */
export function registerServiceWorker(url: string): void {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return

  // Whether a worker was already in charge when this page started. A first
  // visit has none, and its worker taking over is not an upgrade — nothing on
  // screen is stale, so reloading then would be pointless churn.
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController || reloading) return
    // A reload loop would be far worse than a stale page, so only ever once.
    try {
      if (sessionStorage.getItem('todo.swUpgraded')) return
      sessionStorage.setItem('todo.swUpgraded', '1')
    } catch {
      /* private mode: the flag above is the belt, `reloading` is the braces */
    }
    reloading = true
    location.reload()
  })

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(url).catch(function () {
      /* offline support is optional; never take the app down with it */
    })
  })
}
