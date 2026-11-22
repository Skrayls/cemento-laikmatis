import { defineConfig } from '@playwright/test';

const port = Number(process.env.CEMENT_TIMER_TEST_PORT ?? 4174);
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    baseURL: url,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url,
    env: { CEMENT_TIMER_PORT: String(port) },
  },
});
