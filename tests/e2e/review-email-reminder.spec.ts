import { expect, test, type Page, type Response } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface ReminderFixture {
  email: string;
  password: string;
  otherOwnerCanary: string;
  secretCanary: string;
}

const fixturePath = path.resolve(".setup-e2e/plan/fixtures.json");

function loadFixture(projectName: string): ReminderFixture {
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<
    string,
    ReminderFixture
  >;
  const fixture = fixtures[projectName];

  if (!fixture) {
    throw new Error(`Missing reminder fixture for ${projectName}`);
  }

  return fixture;
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return root.scrollWidth > root.clientWidth || body.scrollWidth > body.clientWidth;
  });

  expect(hasHorizontalOverflow).toBe(false);
}

function captureRsc(page: Page) {
  const payloads: string[] = [];
  const pending: Promise<void>[] = [];
  const capture = (response: Response) => {
    const contentType = response.headers()["content-type"] ?? "";
    if (!contentType.includes("text/x-component")) {
      return;
    }

    pending.push(
      Promise.race<string>([
        response.text(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Response body read timed out")), 3_000),
        ),
      ])
        .then((body) => payloads.push(body))
        .then(() => undefined)
        .catch(() => undefined)
    );
  };

  page.on("response", capture);
  return {
    async read() {
      await Promise.all(pending);
      return payloads.join("\n");
    },
  };
}

async function selectReminderTab(page: Page) {
  await page.getByRole("tab", { name: "Email reminders" }).click();
  const reminder = page.getByRole("region", {
    name: "Monthly Review email reminder",
  });
  await expect(reminder).toBeVisible();
  return reminder;
}

test("an owner controls Monthly Review email reminder consent", async ({ page }, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);

  await page.goto("/login");
  await page.getByLabel(/^(Email|邮箱)$/).fill(fixture.email);
  await page.getByLabel(/^(Password|密码)$/).fill(fixture.password);
  await page.getByRole("button", { name: /^(Log in|登录)$/ }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const captured = captureRsc(page);
  await page.reload();
  let reminder = await selectReminderTab(page);
  const consent = reminder.getByRole("checkbox", {
    name: "I agree to receive a Monthly Review reminder email when my previous review is still open.",
  });
  const enableButton = reminder.getByRole("button", {
    name: "Enable email reminders",
  });

  await expect(reminder.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(enableButton).toBeDisabled();
  await expect(reminder).toContainText("On the 2nd of each month at 09:00 (Asia/Singapore).");
  await expectNoHorizontalOverflow(page);

  await consent.check();
  await expect(enableButton).toBeEnabled();
  await enableButton.click();
  await expect(reminder.getByText("Enabled", { exact: true })).toBeVisible();
  await expect(reminder.getByRole("button", { name: "Unsubscribe from emails" })).toBeVisible();
  await expect(reminder).toContainText(
    "Unsubscribing blocks reminders that have not started dispatch.",
  );
  await expectNoHorizontalOverflow(page);

  if (process.env.CAPTURE_REMINDER_REVIEW === "1") {
    const reviewDirectory = path.resolve(".impeccable/review");
    fs.mkdirSync(reviewDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(
        reviewDirectory,
        testInfo.project.name === "mobile-chromium"
          ? "mobile.png"
          : "desktop.png"
      ),
      fullPage: true,
    });
  }

  await page.goto("/settings");
  reminder = await selectReminderTab(page);
  await expect(reminder.getByText("Enabled", { exact: true })).toBeVisible();
  await expect(
    reminder.getByText(/Once dispatch starts, that email may still arrive/),
  ).toBeVisible();

  await reminder.getByRole("button", { name: "Unsubscribe from emails" }).click();
  await expect(reminder.getByText("Disabled", { exact: true })).toBeVisible();

  const reenableConsent = reminder.getByRole("checkbox", {
    name: "I agree to receive a Monthly Review reminder email when my previous review is still open.",
  });
  await reenableConsent.check();
  await reminder.getByRole("button", { name: "Enable email reminders" }).click();
  await expect(reminder.getByText("Enabled", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const payload = await captured.read();
  for (const forbiddenValue of [
    "owner_id",
    "unsubscribe_token",
    "review_reminder_enabled_at",
    "review_reminder_unsubscribed_at",
    fixture.otherOwnerCanary,
    fixture.secretCanary,
  ]) {
    expect(payload).not.toContain(forbiddenValue);
  }
});
