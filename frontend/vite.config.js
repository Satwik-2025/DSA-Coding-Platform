import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  }
})
