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
      response
        .text()
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
    page.getByRole("heading", { level: 1, name: "Set your savings starting point" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your region" })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("Your region");
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Language and locale").selectOption("en-SG");
  await page.getByLabel("Time zone").selectOption("Asia/Singapore");
  await page.getByLabel("Base currency").selectOption("SGD");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByRole("heading", { name: "Your savings account" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your savings account" })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("Your savings account");
  await expect(page.getByText(fixture.otherOwnerCanary, { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Account name").fill(fixture.accountName);
  await expect(page.getByLabel("Institution (optional)")).toHaveValue("");
  await page.getByRole("button", { name: "Save and continue" }).dblclick();

  await expect(page.getByRole("heading", { name: "Your current balance" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your current balance" })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("Your current balance");
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

  await page.getByLabel("Current balance").fill("1234.56");
  await expect(page.getByLabel("Balance as of")).not.toHaveValue("");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/\/setup\/complete$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Your starting point is saved" }),
  ).toBeVisible();
  await expect(page.getByText(/^You’re starting with/)).toContainText("S$1,234.56");
  await expect(page.getByText(/^You’re starting with/)).toContainText(fixture.accountName);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("S$1,234.56", { exact: true }).first()).toBeVisible();

  await page.goto("/setup");
  await expect(page).toHaveURL(/\/$/);

  const responsePayload = await captured.read();
  expect(responsePayload).not.toContain("owner_id");
  expect(responsePayload).not.toContain("api_key");
  expect(responsePayload).not.toContain(fixture.otherOwnerCanary);
  expect(responsePayload).not.toContain(fixture.secretCanary);
});
