import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:3100', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: 'file:./data/browser.db',
      SESSION_PASSWORD: 'test-session-password-must-be-at-least-32-characters',
      APP_ORIGIN: 'http://127.0.0.1:3100',
      COOKIE_SECURE: 'false',
    },
  },
});
