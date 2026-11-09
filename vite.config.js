import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import galleryExport from './tools/gallery-export-plugin.mjs';

export default defineConfig({
  plugins: [galleryExport(fileURLToPath(new URL('./exports/gallery', import.meta.url)))],
  server: { port: 5173, strictPort: true, hmr: false, watch: { ignored: ['**/out/**', '**/ref/**', '**/tools/**', '**/shots/**'] } },
  optimizeDeps: { include: ['three'] },
});
