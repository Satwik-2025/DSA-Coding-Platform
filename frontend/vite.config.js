import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Large libraries get their own long-cacheable chunks, loaded only by the pages that use them.
function vendorChunk(id) {
  if (!id.includes('node_modules')) return undefined
  if (/[\\/](@codemirror|@uiw|@lezer|codemirror|style-mod|w3c-keyname|crelt)[\\/]/.test(id)) return 'editor'
  if (/[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|lodash)[\\/]/.test(id)) return 'charts'
  if (/[\\/](react-markdown|remark-[^\\/]+|rehype-[^\\/]+|micromark[^\\/]*|mdast-[^\\/]+|hast-[^\\/]+|unist-[^\\/]+|unified|vfile[^\\/]*)[\\/]/.test(id)) return 'markdown'
  if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/.test(id)) return 'react'
  return undefined
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The backend port lives in ONE place (.env), not in every fetch call.
  const backend = env.BACKEND_URL || 'http://localhost:8081'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Fail instead of silently moving to 5174: CorsConfig only allows 5173 (app.cors.allowed-origin).
      strictPort: true,
      // The browser only ever talks to 5173; Vite forwards /api to Spring Boot.
      // Same origin from the browser's view, so no CORS preflight during development.
      proxy: { '/api': backend },
    },
    build: {
      rollupOptions: { output: { manualChunks: vendorChunk } },
      // The code-editor chunk (~1 MB, ~350 KB gzipped) is large by nature and only loads on a problem page.
      chunkSizeWarningLimit: 1200,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
    },
  }
})
