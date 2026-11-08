import { defineConfig } from 'vite'

export default defineConfig({
  // Served from the root of lab.morpheustech.net (public/CNAME), not from
  // a github.io project path.
  base: '/',
  // Registered in ~/aquila/docs/ports.md (external tenants). Loopback only.
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
})
