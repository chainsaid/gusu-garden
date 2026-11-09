import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import galleryExport from '../tools/gallery-export-plugin.mjs';

export default defineConfig({
  plugins: [galleryExport(fileURLToPath(new URL('../exports/gallery', import.meta.url)))],
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
  },
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three-vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'three',
      'three/addons/controls/OrbitControls.js',
      'three/addons/loaders/GLTFLoader.js',
      'three/addons/loaders/DRACOLoader.js'
    ],
  },
});

