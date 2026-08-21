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
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
    base: './',
    build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000 } : {},
  }
})
