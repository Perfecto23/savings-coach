import { defineConfig, devices } from "@playwright/test";

const port = 43123;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  globalTeardown: "./tests/e2e/setup-global-teardown.ts",
  testDir: "./tests/e2e",
  testMatch: "review-email-reminder.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: `REVIEW_EMAIL_FEATURE_ENABLED=true bash scripts/start-plan-e2e-server.sh ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
