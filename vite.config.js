import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces one self-contained dist/index.html (Three.js included)
// that can be opened straight from disk or shared anywhere.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { chunkSizeWarningLimit: 2000 },
});
