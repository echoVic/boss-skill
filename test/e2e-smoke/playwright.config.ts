import { defineConfig, devices } from '@playwright/test';

/**
 * 最小 Playwright 冒烟测试配置。
 * 基于 examples/api-auth Express 服务验证框架跑通。
 */
export default defineConfig({
  testDir: '.',
  timeout: 15_000,
  expect: { timeout: 5_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:4567',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'API_KEYS=smoke-test-key node ../../examples/api-auth/src/server.js',
    url: 'http://localhost:4567/health',
    reuseExistingServer: false,
    timeout: 10_000,
    env: { PORT: '4567' },
  },
});
