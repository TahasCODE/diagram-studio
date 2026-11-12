import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { baseURL: process.env.APP_URL || 'http://127.0.0.1:5173', channel: process.env.CI ? undefined : 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev', url:'http://127.0.0.1:5173', reuseExistingServer:true, timeout:30000 },
});
