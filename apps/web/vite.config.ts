import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
