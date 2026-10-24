import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
  },
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
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

