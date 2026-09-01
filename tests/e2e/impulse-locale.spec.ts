import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface ImpulseFixture {
  email: string;
  password: string;
}

const fixturePath = path.resolve(".setup-e2e/plan/fixtures.json");

function loadFixture(projectName: string): ImpulseFixture {
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<
    string,
    ImpulseFixture
  >;
  const fixture = fixtures[projectName];

  if (!fixture) {
    throw new Error(`Missing Impulse E2E fixture for ${projectName}`);
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

test("中文环境下可记录并删除冲动拦截", async ({ page }, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);
  const expected = {
    locale: "zh-CN",
    title: "冲动拦截",
    formTitle: "记录一次冲动拦截",
    empty: "还没有冲动拦截记录。下次决定不买计划外物品时，可以记录下来。",
    itemLabel: "你决定不买什么？",
    amountLabel: "拦截金额（CNY）",
    reasonLabel: "你为什么停下来？",
    submit: "记录冲动拦截",
    amount: "¥123.45",
    amountAria: "拦截金额：¥123.45",
    date: /\d{4}年\d{1,2}月\d{1,2}日/,
    delete: "删除",
    deleteConfirm: "删除这条冲动拦截记录？",
  };

  await page.goto("/login");
  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/impulse");
  await expect(page.getByRole("region", { name: expected.title })).toHaveAttribute(
    "lang",
    expected.locale,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: expected.title }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: expected.formTitle })).toBeVisible();
  await expect(page.getByText(expected.empty, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const itemName = `降噪耳机 ${testInfo.project.name}`;
  await page.getByLabel(expected.itemLabel).fill(itemName);
  await page.getByLabel(expected.amountLabel).fill("123.45");
  await page
    .getByLabel(expected.reasonLabel)
    .fill("先等一周再决定");
  await page.getByRole("button", { name: expected.submit }).click();

  const record = page.getByRole("listitem").filter({ hasText: itemName });
  await expect(record).toContainText(expected.amount);
  await expect(record).toContainText(expected.date);
  await expect(record.getByLabel(expected.amountAria)).toBeVisible();

  if (process.env.CAPTURE_IMPULSE_REVIEW === "1") {
    const reviewDirectory = path.resolve(".impeccable/review");
    fs.mkdirSync(reviewDirectory, { recursive: true });
    const screenshotName = testInfo.project.name.startsWith("mobile")
      ? "impulse-mobile.png"
      : "impulse-desktop.png";
    await page.screenshot({
      path: path.join(reviewDirectory, screenshotName),
      fullPage: true,
    });
  }

  await record.getByRole("button", { name: expected.delete }).click();
  const confirmDialog = page.getByRole("dialog", { name: "确认删除" });
  await expect(confirmDialog).toContainText(expected.deleteConfirm);
  await expect(confirmDialog.getByRole("button", { name: "取消" })).toBeVisible();
  await expect(confirmDialog.getByRole("button", { name: "确认删除" })).toBeVisible();

  await confirmDialog.getByRole("button", { name: "取消" }).click();
  await expect(confirmDialog).toBeHidden();
  await expect(record).toBeVisible();

  await record.getByRole("button", { name: expected.delete }).click();
  await confirmDialog.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText(expected.empty, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: expected.title })).toBeFocused();
});
