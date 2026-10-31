import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pwaPlugin } from './pwa/plugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), pwaPlugin()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', globals: true },
});
