const { defineConfig } = require('@playwright/test');
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const port = new URL(baseURL).port || '80';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: [['line']],
  use: {
    baseURL,
    headless: true,
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: baseURL,
    env: { ...process.env, PORT: port, OPEN_BROWSER: '0' },
    reuseExistingServer: !process.env.CI,
    timeout: 10_000
  }
});
