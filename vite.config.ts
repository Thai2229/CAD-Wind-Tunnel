import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// No 'unsafe-eval' here: occt-import-js needs it, so it runs in a worker whose script gets its own looser CSP header (see vercel.json).
const CSP =
  "default-src 'self'; script-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; object-src 'none'"

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
