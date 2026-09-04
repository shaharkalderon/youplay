import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/youplay/, so every asset URL needs the
// subpath. Overridable for other hosts: BASE_PATH=/ npm run build.
const base = process.env.BASE_PATH ?? '/youplay/'

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: true },
})
