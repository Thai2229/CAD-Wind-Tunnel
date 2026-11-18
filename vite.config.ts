import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const CSP =
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; worker-src 'self' blob:"

// Build only: the dev server needs inline scripts and ws: for HMR.
const csp = {
  name: 'csp-meta',
  apply: 'build' as const,
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' as const },
  ],
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), csp],
})
