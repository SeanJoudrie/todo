/**
 * Turns the single-file build into an Artifact-ready page.
 *
 * Artifacts supply their own <!doctype>/<html>/<head>/<body>, so this strips
 * that wrapper and emits just the <title>, the inlined <style>, the mount
 * point, and the inlined <script>.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const src = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8')

const styles = [...src.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0])
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0])

if (styles.length === 0 || scripts.length === 0) {
  throw new Error(`Expected inlined style and script; got ${styles.length} styles, ${scripts.length} scripts.`)
}

const page = [
  '<title>Dump It</title>',
  ...styles,
  '<div id="root"></div>',
  ...scripts,
  '',
].join('\n')

mkdirSync(new URL('../dist-artifact/', import.meta.url), { recursive: true })
writeFileSync(new URL('../dist-artifact/app.html', import.meta.url), page)
console.log(`wrote dist-artifact/app.html (${(page.length / 1024).toFixed(0)} kB)`)
