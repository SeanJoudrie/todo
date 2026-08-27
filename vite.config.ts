import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Two outputs from one source:
 *   default      -> dist/         normal static site (GitHub Pages, any host)
 *   --mode single -> dist-single/ one self-contained .html, for hosts that take a single file
 *
 * base './' keeps asset paths relative so the build works from any subpath.
 */
/** Stamped into the build so the running version is never in doubt. */
function buildStamp(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim()
    return `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${sha}`
  } catch {
    return new Date().toISOString().slice(0, 16).replace('T', ' ')
  }
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    define: { __BUILD__: JSON.stringify(buildStamp()) },
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
    base: './',
    build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000 } : {},
  }
})
