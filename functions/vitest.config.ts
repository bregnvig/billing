import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Also runs the shared model's tests (../model), in Node with full time-zone data.
export default defineConfig({
  resolve: {
    alias: { '@loopme/model': fileURLToPath(new URL('../model/index.ts', import.meta.url)) },
  },
  test: {
    dir: fileURLToPath(new URL('..', import.meta.url)),
    include: ['functions/src/**/*.spec.ts', 'model/**/*.spec.ts'],
  },
});
