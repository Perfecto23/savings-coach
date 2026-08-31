import { defineConfig, devices } from "@playwright/test";

const port = 43117;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: [
    "setup-checkpoint.spec.ts",
    "plan-activation.spec.ts",
    "impulse-locale.spec.ts",
    "monthly-review.spec.ts",
    "review-email-reminder.spec.ts",
    "locale-consistency.spec.ts",
  ],
  fullyParallel: false,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-local-anon-key",
    },
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
