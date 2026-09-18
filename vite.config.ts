import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/youplay/, so every asset URL needs the
// subpath. Overridable for other hosts: BASE_PATH=/ npm run build.
const base = process.env.BASE_PATH ?? '/youplay/'

export default defineConfig({
  base,
  plugins: [react()],
  // PORT is honoured so a tool that hands the dev server a free port actually
  // gets it; without this Vite picks 5173 and then walks upwards on its own,
  // and whoever launched it is left guessing which port it landed on.
  server: { host: true, port: process.env.PORT ? Number(process.env.PORT) : undefined },
})
