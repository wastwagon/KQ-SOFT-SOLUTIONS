import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { seoStaticFiles } from './vite-plugin-seo'

// https://vite.dev/config/
// VITE_BASE=/subdir/ — subdirectory hosting (must match Coolify path).
// VITE_SITE_URL=https://your-domain.com — canonical, OG, and sitemap URLs.
export default defineConfig({
  plugins: [react(), seoStaticFiles()],
  base: process.env.VITE_BASE ?? '/',
})
