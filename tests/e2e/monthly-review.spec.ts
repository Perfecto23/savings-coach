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

test("an owner closes the previous Monthly Review and starts the current month", async ({
  page,
}, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);
  const reviewMonth = formatMonth(fixture.reviewYearMonth);
  const currentMonth = formatMonth(fixture.currentYearMonth);
  const captured = captureRscAndHtml(page);
  const paymentRequests: string[] = [];
  page.on("request", (request) => {
    if (/js\.stripe\.com|checkout\.stripe\.com|paypal\.com/i.test(request.url())) {
      paymentRequests.push(request.url());
    }
  });

  await page.goto("/login");
  await page.getByLabel(/^(Email|邮箱)$/).fill(fixture.email);
  await page.getByLabel(/^(Password|密码)$/).fill(fixture.password);
  await page.getByRole("button", { name: /^(Log in|登录)$/ }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: `Review ${reviewMonth} before starting ${currentMonth}.` })).toBeVisible();
  await expect(page.getByText("1 of 1 Monthly Actions confirmed", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: `Review ${reviewMonth}` }).click();
  await expect(page).toHaveURL(new RegExp(`/milestones/${fixture.reviewYearMonth}/report$`));
  await expect(page.getByRole("heading", { level: 1, name: `${reviewMonth} Monthly report` })).toBeVisible();
  await expect(page.getByText("S$500.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/does not confirm a bank balance or transfer/)).toBeVisible();

  await page.getByRole("button", { name: `Close ${reviewMonth}` }).click();
  await expect(page.getByText("Review complete", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${reviewMonth} is closed.` })).toBeVisible();

  const offer = page.getByRole("region", { name: "Savings Coach Pro beta offer" });
  await expect(offer.getByRole("heading", { name: "Help shape Savings Coach Pro" })).toBeVisible();
  await expect(offer.getByText("US$4.99/month after launch", { exact: true })).toBeVisible();
  await expect(offer.getByText(/Today: no charge\. No card\. No subscription\./)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /card/i })).toHaveCount(0);
  await offer.getByRole("button", { name: "I'm interested in Pro beta" }).click();
  await expect(page.getByText("Interest recorded", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "You were not charged, and no subscription was created.",
    })
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Interest recorded", { exact: true })).toBeVisible();
  expect(paymentRequests).toEqual([]);

  if (testInfo.project.name === "desktop-chromium") {
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel(/^(Email|邮箱)$/).fill(fixture.email);
    await page.getByLabel(/^(Password|密码)$/).fill(fixture.password);
    await page.getByRole("button", { name: /^(Log in|登录)$/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(`/milestones/${fixture.reviewYearMonth}/report`);
    await expect(page.getByText("Interest recorded", { exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: `Open ${currentMonth}` }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("region", { name: "Next Monthly Action" })).toContainText("S$500.00");
  await expect(page.getByRole("region", { name: "Next Monthly Action" })).toContainText("Monthly Review Action");
  await page.reload();
  await expect(page.getByRole("region", { name: "Next Monthly Action" })).toContainText("S$500.00");

  await page.goto(`/sop?month=${fixture.reviewYearMonth}`);
  await expect(page.getByText(/This month is closed/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as incomplete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByText(/Add a temporary step/)).toHaveCount(0);

  await page.goto("/milestones");
  const reviewedRow = page.getByRole("row").filter({ hasText: reviewMonth });
  await expect(reviewedRow).toContainText("Reviewed");
  await expectNoHorizontalOverflow(page);

  const responsePayload = await captured.read();
  for (const forbiddenValue of [
    "owner_id",
    "api_key",
    "template_id",
    "step_key",
    "paid_intent_offer_code",
    "paid_intent_recorded_at",
    fixture.otherOwnerCanary,
    fixture.secretCanary,
  ]) {
    expect(responsePayload).not.toContain(forbiddenValue);
  }
});
