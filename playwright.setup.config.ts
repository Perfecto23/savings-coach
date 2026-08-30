import { defineConfig, devices } from "@playwright/test";

const port = 43118;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  globalTeardown: "./tests/e2e/setup-global-teardown.ts",
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
    command: `bash scripts/start-setup-e2e-server.sh ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
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
