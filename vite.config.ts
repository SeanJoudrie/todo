import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the built app works from any path, including file://
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
})
