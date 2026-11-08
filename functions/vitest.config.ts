import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Node-side tests: functions, the shared model (full time-zone data) and repo checks in tools/.
export default defineConfig({
  resolve: {
    alias: { '@loopme/model': fileURLToPath(new URL('../model/index.ts', import.meta.url)) },
  },
  test: {
    dir: fileURLToPath(new URL('..', import.meta.url)),
    include: ['functions/src/**/*.spec.ts', 'model/**/*.spec.ts', 'tools/**/*.spec.ts'],
  },
});
