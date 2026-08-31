import { defineConfig, devices } from "@playwright/test";

const port = 43125;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  globalTeardown: "./tests/e2e/setup-global-teardown.ts",
  testDir: "./tests/e2e",
  testMatch: "impulse-locale.spec.ts",
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
    command: `IMPULSE_E2E=1 bash scripts/start-plan-e2e-server.sh ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: "desktop-zh-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-zh-chromium",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "desktop-en-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-en-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
