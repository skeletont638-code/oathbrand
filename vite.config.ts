/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/oathbrand/',
  test: {
    // Unit tests live beside the code under src/. Keep Vitest away from e2e/
    // (Playwright specs), which import a different `test`/`expect` runtime.
    include: ['src/**/*.test.ts'],
  },
});
