import { defineConfig, createLogger } from 'vite';
import { svelte }             from '@sveltejs/vite-plugin-svelte';
import tailwindcss            from '@tailwindcss/vite';
import { nodePolyfills }      from 'vite-plugin-node-polyfills';

const logger = createLogger();
const loggerWarn = logger.warn.bind(logger);
logger.warn = (msg, opts) => {
  // asn1.js vm import is wrapped in try/catch and falls back gracefully — safe to ignore
  if (msg.includes('"vm"')) return;
  loggerWarn(msg, opts);
};

export default defineConfig({
  customLogger: logger,
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 19).replace('T', ' ')),
  },
  plugins: [
    tailwindcss(),
    svelte(),
    nodePolyfills({
      globals:         { Buffer: true, global: true, process: true },
      protocolImports: true,
      exclude:         ['vm'],   // vm-browserify uses eval — we don't need vm
    }),
  ],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    assetsDir: '_app',            // keeps /assets/ free for public/ user files
    chunkSizeWarningLimit: 8000,  // web3auth lazy chunk is ~2.6MB, only loads on sign-in
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INVALID_ANNOTATION') return; // ox/_esm, harmless
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        // asn1.js uses vm only for named-function stack traces, falls back gracefully
        if (warning.message?.includes('"vm"')) return;
        warn(warning);
      },
    },
  },
  server: {
    // Proxy API and socket calls to the Fastify server during dev.
    // secure: false because the local TLS cert is self-signed (mkcert).
    proxy: {
      '/api':       { target: 'https://localhost:3000', secure: false },
      '/assets':    { target: 'https://localhost:3000', secure: false },
      '/socket.io': { target: 'https://localhost:3000', secure: false, ws: true },
    },
  },
});
