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
  return new Intl.DateTimeFormat("zh-CN", {
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
  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: `先复盘 ${reviewMonth}，再开始 ${currentMonth}。` })).toBeVisible();
  await expect(page.getByText("已确认 1/1 个月度行动", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: `复盘 ${reviewMonth}` }).click();
  await expect(page).toHaveURL(new RegExp(`/milestones/${fixture.reviewYearMonth}/report$`));
  await expect(page.getByRole("heading", { level: 1, name: `${reviewMonth} 月度报告` })).toBeVisible();
  await expect(page.getByText("¥500.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/不确认银行余额或转账/)).toBeVisible();

  await page.getByRole("button", { name: `关闭 ${reviewMonth}` }).click();
  await expect(page.getByText("复盘完成", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${reviewMonth} 已关闭。` })).toBeVisible();

  const offer = page.getByRole("region", { name: "储蓄教练专业版内测方案" });
  await expect(offer.getByRole("heading", { name: "参与完善储蓄教练专业版" })).toBeVisible();
  await expect(offer.getByText("正式发布后每月 4.99 美元", { exact: true })).toBeVisible();
  await expect(offer.getByText(/今天不会收费，无需银行卡，也不会创建订阅/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /银行卡/ })).toHaveCount(0);
  await offer.getByRole("button", { name: "我对专业版内测感兴趣" }).click();
  await expect(page.getByText("付费意愿已记录", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "没有产生收费，也没有创建订阅。",
    })
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("付费意愿已记录", { exact: true })).toBeVisible();
  expect(paymentRequests).toEqual([]);

  if (testInfo.project.name === "desktop-chromium") {
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("邮箱").fill(fixture.email);
    await page.getByLabel("密码").fill(fixture.password);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(`/milestones/${fixture.reviewYearMonth}/report`);
    await expect(page.getByText("付费意愿已记录", { exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: `打开 ${currentMonth}` }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("region", { name: "下一月度行动" })).toContainText("¥500.00");
  await expect(page.getByRole("region", { name: "下一月度行动" })).toContainText("月度复盘行动");
  await page.reload();
  await expect(page.getByRole("region", { name: "下一月度行动" })).toContainText("¥500.00");

  await page.goto(`/sop?month=${fixture.reviewYearMonth}`);
  await expect(page.getByText(/该月份已关闭/)).toBeVisible();
  await expect(page.getByRole("button", { name: "标记为未完成" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "编辑" })).toHaveCount(0);
  await expect(page.getByText(/添加临时步骤/)).toHaveCount(0);

  await page.goto("/milestones");
  const reviewedRow = page.getByRole("row").filter({ hasText: reviewMonth });
  await expect(reviewedRow).toContainText("已复盘");
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
