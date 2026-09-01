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
  await page.getByRole("tab", { name: "邮件提醒" }).click();
  const reminder = page.getByRole("region", {
    name: "月度复盘邮件提醒",
  });
  await expect(reminder).toBeVisible();
  return reminder;
}

test("中文环境下可控制月度复盘邮件提醒授权", async ({ page }, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);

  await page.goto("/login");
  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  const captured = captureRsc(page);
  await page.reload();
  let reminder = await selectReminderTab(page);
  const consent = reminder.getByRole("checkbox", {
    name: "我同意在上一月月度复盘仍未完成时接收提醒邮件。",
  });
  const enableButton = reminder.getByRole("button", {
    name: "启用邮件提醒",
  });

  await expect(reminder.getByText("已关闭", { exact: true })).toBeVisible();
  await expect(enableButton).toBeDisabled();
  await expect(reminder).toContainText("每月 2 日 09:00 (Asia/Singapore)发送。");
  await expectNoHorizontalOverflow(page);

  await consent.check();
  await expect(enableButton).toBeEnabled();
  await enableButton.click();
  await expect(reminder.getByText("已启用", { exact: true })).toBeVisible();
  await expect(reminder.getByRole("button", { name: "退订邮件提醒" })).toBeVisible();
  await expect(reminder).toContainText(
    "退订会阻止尚未开始发送的提醒。",
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
  await expect(reminder.getByText("已启用", { exact: true })).toBeVisible();
  await expect(
    reminder.getByText(/发送开始后，该邮件仍可能/),
  ).toBeVisible();

  await reminder.getByRole("button", { name: "退订邮件提醒" }).click();
  await expect(reminder.getByText("已关闭", { exact: true })).toBeVisible();

  const reenableConsent = reminder.getByRole("checkbox", {
    name: "我同意在上一月月度复盘仍未完成时接收提醒邮件。",
  });
  await reenableConsent.check();
  await reminder.getByRole("button", { name: "启用邮件提醒" }).click();
  await expect(reminder.getByText("已启用", { exact: true })).toBeVisible();
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
