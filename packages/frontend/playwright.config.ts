import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 5173);

// Use localhost by default (macOS + IPv6 can make 127.0.0.1 polling flaky)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

// Detect CI environment
const CI = process.env.CI === 'true' || process.env.CI === '1';

export default defineConfig({
  testDir: './e2e',
  // Exclude debug tests from default runs
  testIgnore: '**/e2e/_debug/**',
  fullyParallel: true,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,

  // Production-grade reporters
  reporter: CI
    ? [
        ['github'],  // GitHub Actions annotations
        ['html', { open: 'never' }],  // HTML report for artifacts
        ['list'],  // Console output
      ]
    : [['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    // Capture traces and screenshots on failure
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Starts backend + frontend + prepares DB
    command: 'node ../../scripts/start-e2e-servers.js',
    url: BASE_URL,
    timeout: 120000,
    reuseExistingServer: !CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});