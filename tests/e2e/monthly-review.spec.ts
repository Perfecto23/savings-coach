import { expect, test, type Page, type Response } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface ReviewFixture {
  email: string;
  password: string;
  reviewYearMonth: string;
  currentYearMonth: string;
  otherOwnerCanary: string;
  secretCanary: string;
}

const fixturePath = path.resolve(".setup-e2e/plan/fixtures.json");

function loadFixture(projectName: string): ReviewFixture {
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<
    string,
    ReviewFixture
  >;
  const fixture = fixtures[projectName];
  if (!fixture?.reviewYearMonth || !fixture.currentYearMonth) {
    throw new Error(`Missing Monthly Review fixture for ${projectName}`);
  }
  return fixture;
}

function formatMonth(yearMonth: string) {
  return new Intl.DateTimeFormat("en-SG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${yearMonth}-01T00:00:00.000Z`));
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

test("an owner closes the previous Monthly Review and starts the current month", async ({
  page,
}, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);
  const reviewMonth = formatMonth(fixture.reviewYearMonth);
  const currentMonth = formatMonth(fixture.currentYearMonth);
  const captured = captureRscAndHtml(page);

  await page.goto("/login");
  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: `Review ${reviewMonth} before starting ${currentMonth}.` })).toBeVisible();
  await expect(page.getByText("1 of 1 Monthly Actions confirmed", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: `Review ${reviewMonth}` }).click();
  await expect(page).toHaveURL(new RegExp(`/milestones/${fixture.reviewYearMonth}/report$`));
  await expect(page.getByRole("heading", { level: 1, name: `${fixture.reviewYearMonth} Monthly report` })).toBeVisible();
  await expect(page.getByText("S$500.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/does not confirm a bank balance or transfer/)).toBeVisible();

  await page.getByRole("button", { name: `Close ${reviewMonth}` }).click();
  await expect(page.getByText("Review complete", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${reviewMonth} is closed.` })).toBeVisible();

  await page.getByRole("link", { name: `Open ${currentMonth}` }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("region", { name: "Next Monthly Action" })).toContainText("S$500.00");
  await expect(page.getByRole("region", { name: "Next Monthly Action" })).toContainText("Monthly Review Action");
  await page.reload();
  await expect(page.getByRole("region", { name: "Next Monthly Action" })).toContainText("S$500.00");

  await page.goto(`/sop?month=${fixture.reviewYearMonth}`);
  await expect(page.getByText(/This month is closed/)).toBeVisible();
  await expect(page.getByRole("button", { name: "标记为未完成" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "编辑" })).toHaveCount(0);
  await expect(page.getByText(/添加临时操作/)).toHaveCount(0);

  await page.goto("/milestones");
  const reviewedRow = page.getByRole("row").filter({ hasText: fixture.reviewYearMonth });
  await expect(reviewedRow).toContainText("Reviewed");
  await expectNoHorizontalOverflow(page);

  const responsePayload = await captured.read();
  for (const forbiddenValue of [
    "owner_id",
    "api_key",
    "template_id",
    "step_key",
    fixture.otherOwnerCanary,
    fixture.secretCanary,
  ]) {
    expect(responsePayload).not.toContain(forbiddenValue);
  }
});
