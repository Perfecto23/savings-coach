import { defineConfig, devices } from "@playwright/test";
import { configureAuthenticatedRun } from "./tests/e2e/authenticated-run";

const port = 43118;
const baseURL = `http://127.0.0.1:${port}`;
const runToken = configureAuthenticatedRun("setup", ".setup-e2e");

export default defineConfig({
  globalTeardown: "./tests/e2e/authenticated-global-teardown.ts",
  testDir: "./tests/e2e",
  testMatch: "setup-checkpoint.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  webServer: {
    command: `SAVINGS_E2E_RUN_TOKEN=${runToken} bash scripts/start-setup-e2e-server.sh ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], locale: "en-US" },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], locale: "en-SG" },
    },
  ],
});
