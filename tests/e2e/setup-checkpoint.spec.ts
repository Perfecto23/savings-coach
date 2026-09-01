import { expect, test, type Page, type Response } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface SetupFixture {
  email: string;
  password: string;
  accountName: string;
  otherOwnerCanary: string;
  secretCanary: string;
}

const fixturePath = path.resolve(".setup-e2e/fixtures.json");

function loadFixture(projectName: string): SetupFixture {
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<
    string,
    SetupFixture
  >;
  const fixture = fixtures[projectName];

  if (!fixture) {
    throw new Error(`Missing Setup E2E fixture for ${projectName}`);
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

function captureRscAndHtml(page: Page) {
  const payloads: string[] = [];
  const pending: Promise<void>[] = [];

  const capture = (response: Response) => {
    const contentType = response.headers()["content-type"] ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/x-component")) {
      return;
    }

    pending.push(
      Promise.race<string>([
        response.text(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Response body read timed out")), 3_000),
        ),
      ])
        .then((body) => {
          payloads.push(body);
        })
        .catch(() => {
          // Redirects and aborted navigations may not expose a response body.
        }),
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

test("an invited owner can save and recover the three Setup checkpoints", async ({
  page,
}, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);
  const captured = captureRscAndHtml(page);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/setup$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "设置你的储蓄起点" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "地区偏好" })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("地区偏好");
  await expect(page.getByLabel("语言与地区")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("时区").selectOption("Asia/Singapore");
  await page.getByLabel("基础货币").selectOption("CNY");
  await page.getByRole("button", { name: "保存并继续" }).click();

  await expect(page.getByRole("heading", { name: "储蓄账户" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "储蓄账户" })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("储蓄账户");
  await expect(page.getByText(fixture.otherOwnerCanary, { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("账户名称").fill(fixture.accountName);
  await expect(page.getByLabel("机构（可选）")).toHaveValue("");
  await page.getByRole("button", { name: "保存并继续" }).dblclick();

  await expect(page.getByRole("heading", { name: "当前余额" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "当前余额" })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("当前余额");
  await expect(
    page
      .getByText(fixture.accountName, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  if (process.env.CAPTURE_SETUP_REVIEW === "1") {
    const reviewDirectory = path.resolve(".impeccable/review");
    fs.mkdirSync(reviewDirectory, { recursive: true });
    const screenshotName = testInfo.project.name.startsWith("mobile")
      ? "mobile.png"
      : "desktop.png";
    await page.screenshot({
      path: path.join(reviewDirectory, screenshotName),
      fullPage: true,
    });
  }

  await page.getByLabel("当前余额").fill("1234.56");
  await expect(page.getByLabel("余额日期")).toHaveAttribute("type", "text");
  await expect(page.getByLabel("余额日期")).toHaveAttribute("placeholder", "YYYY-MM-DD");
  await expect(page.getByLabel("余额日期")).not.toHaveValue("");
  await page.getByRole("button", { name: "保存并继续" }).click();

  await expect(page).toHaveURL(/\/setup\/complete$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "储蓄起点已保存" }),
  ).toBeVisible();
  await expect(page.getByText(/^你的起始余额为/)).toContainText("¥1,234.56");
  await expect(page.getByText(/^你的起始余额为/)).toContainText(fixture.accountName);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "本月" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "建立储蓄计划" })).toBeVisible();

  await page.goto("/setup/complete");
  await expect(page.getByText("¥1,234.56", { exact: true }).first()).toBeVisible();

  await page.goto("/setup");
  await expect(page).toHaveURL(/\/$/);

  const responsePayload = await captured.read();
  expect(responsePayload).not.toContain("owner_id");
  expect(responsePayload).not.toContain("api_key");
  expect(responsePayload).not.toContain(fixture.otherOwnerCanary);
  expect(responsePayload).not.toContain(fixture.secretCanary);
});
