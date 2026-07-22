import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/a2mcp': 'http://127.0.0.1:3000' },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/three/')) return 'vendor-three';
          if (id.includes('/gsap/')) return 'vendor-motion';
          if (id.includes('/zod/')) return 'vendor-schema';
          return undefined;
        },
      },
    },
  },
});
