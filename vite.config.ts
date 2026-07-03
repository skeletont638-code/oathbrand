/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/oathbrand/',
  build: {
    // Realism pass (Task 5): the crunched CC0 photo textures MUST stay OUTSIDE
    // the JS bundle as hashed URLs (plan Global Constraints — "no gzip-budget
    // impact"). Two of them crunch below Vite's 4 KB default and would otherwise
    // base64-inline into a JS chunk; force `assets/tex/*` external. Everything
    // else keeps Vite's default inlining.
    assetsInlineLimit: (file: string) => (file.includes('/assets/tex/') ? false : undefined),
  },
  test: {
    // Unit tests live beside the code under src/. Keep Vitest away from e2e/
    // (Playwright specs), which import a different `test`/`expect` runtime.
    include: ['src/**/*.test.ts'],
  },
});
