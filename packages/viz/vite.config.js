import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      // Main bundle — all exports
      entry: {
        'orbital-viz': resolve(import.meta.dirname, 'src/index.js'),
        'globe':       resolve(import.meta.dirname, 'src/globe/index.js'),
        'chart':       resolve(import.meta.dirname, 'src/chart/index.js'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // three.js is a peer dep — don't bundle it, let the consumer provide it
      external: ['three', /^three\/.*/],
    },
    outDir: 'dist',
    sourcemap: true,
  },
});
