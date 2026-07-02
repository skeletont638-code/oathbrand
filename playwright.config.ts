import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config (Task 19). The webServer builds with VITE_E2E=1 (so
 * `window.__oathbrand.state` is exposed) and serves the built bundle under the
 * GitHub-Pages base path `/oathbrand/` via `vite preview`. CI runs `npx
 * playwright test`; locally, an already-running preview is reused.
 */
const PORT = 4173;
const BASE = `http://localhost:${PORT}/oathbrand/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_E2E: '1' },
  },
});
