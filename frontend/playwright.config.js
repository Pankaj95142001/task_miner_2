import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8765', headless: true, viewport: { width: 1440, height: 1050 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    command: '..\\.venv\\Scripts\\python.exe -m uvicorn backend.app.main:create_app --factory --app-dir .. --host 127.0.0.1 --port 8765',
    url: 'http://127.0.0.1:8765/health',
    env: { SOP_DATA_DIR: 'test-results/e2e-data', SOP_TOKEN: 'browser-test-session-token', OPENAI_API_KEY: '', SOP_RECORDER_HEADLESS: '1', SOP_BROWSER_CHANNEL: process.env.SOP_TEST_BROWSER_CHANNEL || 'chromium' },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
