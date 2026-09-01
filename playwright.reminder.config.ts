import { defineConfig, devices } from "@playwright/test";
import { configureAuthenticatedRun } from "./tests/e2e/authenticated-run";

const port = 43123;
const baseURL = `http://127.0.0.1:${port}`;
const runToken = configureAuthenticatedRun("reminder", ".setup-e2e/plan");

export default defineConfig({
  globalTeardown: "./tests/e2e/authenticated-global-teardown.ts",
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
    command: `SAVINGS_E2E_RUN_TOKEN=${runToken} REVIEW_EMAIL_FEATURE_ENABLED=true bash scripts/start-plan-e2e-server.sh ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], locale: "zh-CN" },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], locale: "zh-CN" },
    },
  ],
});
