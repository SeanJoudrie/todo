/**
 * The service worker must never serve an old build on a fresh open.
 *
 * This is a real bug that shipped: the worker was stale-while-revalidate for
 * everything, so opening the link served the previous build and a deploy only
 * appeared on the visit after. The owner saw a half-updated app — a feature
 * from two builds ago present, last build's missing — and reasonably concluded
 * nothing had been fixed.
 *
 * The check that let it through used page.reload(). A reload revalidates; it
 * is not what he does. He taps a link, which is a fresh navigation, so every
 * visit here opens a brand new page.
 *
 * It also has to stay offline-capable, which is the whole reason for the
 * worker, so that is asserted too.
 */
import http from 'node:http'
import fs from 'node:fs'
import { chromium } from 'playwright'

const SW_NEW = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')

/** The worker that shipped before this one, and that the owner still has installed. */
const SW_OLD = `const CACHE = 'todo-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (new URL(req.url).origin !== self.location.origin) return
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req)
    const network = fetch(req).then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone())
      return res
    }).catch(() => cached)
    return cached || network
  }))
})`

// The real registration code, run as-is rather than as a copy free to drift.
// It has no imports and no TypeScript-only syntax, so dropping `export` and the
// return type is the whole of the translation.
const REGISTER = fs
  .readFileSync(new URL('../src/lib/sw-register.ts', import.meta.url), 'utf8')
  .replace('export function registerServiceWorker(url: string): void {', 'function registerServiceWorker(url) {')

let SW = SW_NEW
let BUILD = 'BUILD-A'
const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x')
  if (pathname === '/sw.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache' })
    return res.end(SW)
  }
  if (pathname.startsWith('/assets/')) {
    res.writeHead(200, { 'content-type': 'text/javascript' })
    return res.end(`window.__build = ${JSON.stringify(BUILD)}`)
  }
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end(
    `<!doctype html><title>Todo ${BUILD}</title><body>` +
      `<script src="/assets/app-hash.js"></script>` +
      `<script>${REGISTER}\nregisterServiceWorker('/sw.js')</script>`,
  )
})
await new Promise((resolve) => server.listen(0, resolve))
const base = `http://127.0.0.1:${server.address().port}/`

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })

let failures = 0
const check = (label, actual, expected) => {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label} — ${actual}${ok ? '' : ` (expected ${expected})`}`)
}

/**
 * A fresh open, the way tapping the link works. Never a reload — the earlier
 * version of this check used one, and that is exactly why the bug got through.
 *
 * Replacing the worker reloads the page out from under us, and measurably does
 * not begin for about two seconds, so a title that has merely stopped changing
 * means nothing. Wait for it to hold still for a good while instead.
 */
const QUIET_MS = 3000
async function open(ctx) {
  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'load' })
  let title = ''
  let unchangedFor = 0
  for (let waited = 0; waited < 20_000; waited += 150) {
    await page.waitForTimeout(150)
    // A reload in flight tears down the page context; that is not an error.
    const now = await page.title().catch(() => '')
    if (now === title) unchangedFor += 150
    else {
      title = now
      unchangedFor = 0
    }
    if (unchangedFor >= QUIET_MS && title.startsWith('Todo')) break
  }
  await page.close()
  return title
}

/** Install a worker and let it take charge, then leave the cache warm. */
async function installAndWarm(ctx) {
  const page = await ctx.newPage()
  await page.goto(base)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await page.close()
  // The install visit is not itself controlled, so nothing was cached by it.
  // This second visit is what fills the cache — without it there is nothing
  // stale to serve and the checks below prove nothing.
  return open(ctx)
}

// --- A deploy must reach him on the next open, not the one after ------------
{
  const ctx = await browser.newContext()
  SW = SW_NEW
  BUILD = 'BUILD-A'
  check('a visit before any deploy shows the installed build', await installAndWarm(ctx), 'Todo BUILD-A')

  BUILD = 'BUILD-B' // a deploy lands
  check('the very next open shows the new build', await open(ctx), 'Todo BUILD-B')
  check('and stays on it', await open(ctx), 'Todo BUILD-B')

  await ctx.setOffline(true)
  let offline
  try {
    const page = await ctx.newPage()
    await page.goto(base)
    offline = await page.title()
    await page.close()
  } catch (err) {
    offline = `did not load: ${err.message.split('\n')[0]}`
  }
  check('still opens with no network', offline, 'Todo BUILD-B')
  await ctx.close()
}

// --- Upgrading away from the old worker, which is what he is about to do ----
// He has the stale-while-revalidate worker installed. The visit that replaces
// it is still served by it, so the new build has to arrive without him having
// to know to open the link twice.
{
  const ctx = await browser.newContext()
  SW = SW_OLD
  BUILD = 'BUILD-A'
  check('on the old worker, he sees the old build', await installAndWarm(ctx), 'Todo BUILD-A')

  SW = SW_NEW // the fix deploys
  BUILD = 'BUILD-B'
  check('the open that installs the fix still lands on the new build', await open(ctx), 'Todo BUILD-B')
  check('and it stays fixed after that', await open(ctx), 'Todo BUILD-B')
  await ctx.close()
}

await browser.close()
server.close()

console.log(failures === 0 ? '\nservice worker: all checks passed' : `\nservice worker: ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
