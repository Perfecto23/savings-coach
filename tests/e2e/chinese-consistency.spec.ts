import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface ChineseFixture {
  email: string;
  password: string;
  ruleName: string;
  currentYearMonth: string;
  otherOwnerCanary: string;
  secretCanary: string;
}

const fixturePath = path.resolve(".setup-e2e/plan/fixtures.json");

function loadFixture(projectName: string): ChineseFixture {
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<
    string,
    ChineseFixture
  >;
  const fixture = fixtures[projectName];
  if (!fixture?.currentYearMonth) {
    throw new Error(`Missing Chinese E2E fixture for ${projectName}`);
  }
  return fixture;
}

const ALLOWED_ENGLISH_WORDS = new Set(["Asia", "CNY", "Singapore", "SOP"]);
const CORE_ROUTES = ["/", "/plan", "/sop", "/balances", "/income", "/milestones", "/impulse", "/settings"];

function isMobileProject(projectName: string) {
  return projectName === "mobile-chromium";
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return root.scrollWidth > root.clientWidth || body.scrollWidth > body.clientWidth;
  });

  expect(hasHorizontalOverflow).toBe(false);
}

async function expectChineseSurface(
  page: import("@playwright/test").Page,
  headingLevel: 1 | 2 = 1,
) {
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator('[lang="zh-CN"]:not(html)').first()).toBeVisible();

  const heading = page.getByRole("heading", { level: headingLevel }).first();
  await expect(heading).toBeVisible();
  expect(await heading.innerText()).toMatch(/[\u3400-\u9fff]/u);

  const visibleText = await page.locator("body").innerText();
  const leakedEnglish = Array.from(
    new Set(visibleText.match(/\b[A-Za-z][A-Za-z'-]*\b/g) ?? []),
  ).filter((word) => !ALLOWED_ENGLISH_WORDS.has(word));
  expect(leakedEnglish).toEqual([]);
  await expectNoHorizontalOverflow(page);
}

async function signIn(page: import("@playwright/test").Page, fixture: ChineseFixture) {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page).toHaveTitle("储蓄教练 — 你的个人储蓄伙伴");
  await expect(page.getByRole("heading", { level: 1, name: "储蓄教练" })).toBeVisible();
  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectChineseShell(
  page: import("@playwright/test").Page,
  isMobile: boolean,
) {
  if (isMobile) {
    for (const label of ["首页", "计划", "SOP", "余额"]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    const more = page.getByRole("button", { name: "更多", exact: true });
    await expect(more).toBeVisible();
    await more.click();
    for (const label of ["收入管理", "里程碑", "冲动拦截", "设置"]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "关闭更多导航" }).click();
    return;
  }

  for (const label of [
    "仪表盘",
    "储蓄计划",
    "月度 SOP",
    "余额记录",
    "收入管理",
    "里程碑",
    "冲动拦截",
    "设置",
  ]) {
    await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "退出登录", exact: true })).toBeVisible();
}

test("英文浏览器和存量英文 owner 在全站看到中文产品界面", async ({ page }, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);
  const isMobile = isMobileProject(testInfo.project.name);

  await signIn(page, fixture);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page).toHaveTitle("储蓄教练 — 你的个人储蓄伙伴");
  await expectChineseShell(page, isMobile);
  await expectChineseSurface(page);

  await page.goto("/plan");
  await expectChineseSurface(page);
  await expect(page.getByRole("heading", { name: "添加计划规则" })).toBeVisible();
  await expect(page.getByLabel("规则名称")).toBeVisible();
  await expect(page.getByLabel("规则金额")).toBeVisible();
  await expect(page.getByLabel("到期日")).toBeVisible();
  await expect(page.getByLabel("来源账户（可选）")).toBeVisible();
  await expect(page.getByLabel("目标账户")).toBeVisible();

  if (process.env.CAPTURE_CHINESE_REVIEW === "1") {
    const reviewDirectory = path.resolve(".impeccable/review");
    fs.mkdirSync(reviewDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(reviewDirectory, `chinese-plan-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }

  await page.getByLabel("规则名称").fill(fixture.ruleName);
  await page.getByLabel("规则金额").fill("500");
  await page.getByLabel("到期日").fill("28");
  await page.getByRole("button", { name: "添加规则" }).click();
  await expect(page.getByText(fixture.ruleName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "激活储蓄计划" }).click();
  await expect(page.getByText("你的储蓄计划已激活。", { exact: true })).toBeVisible();
  await expect(page.getByText("¥500.00", { exact: true }).first()).toBeVisible();
  await expect(page.locator("body")).toContainText(/\d{1,2}月\d{1,2}日/u);

  for (const route of CORE_ROUTES) {
    await page.goto(route);
    await expectChineseSurface(page);
    await expectChineseShell(page, isMobile);
  }

  await expect(page.getByRole("heading", { level: 1, name: "设置" })).toBeVisible();
  await page.getByRole("tab", { name: "账户管理" }).click();
  await expect(page.getByRole("tab", { name: "SOP 模板" })).toBeVisible();

  await page.goto("/balances");
  await expect(page.getByRole("heading", { name: "记录余额快照" })).toBeVisible();
  await expect(page.getByLabel("观察日期")).toHaveAttribute("type", "text");
  await expect(page.getByLabel("观察日期")).toHaveAttribute("placeholder", "YYYY-MM-DD");
  await expect(page.getByLabel(/余额快照/).first()).toBeVisible();
  await expect(page.getByText("¥1,000.00", { exact: true }).first()).toBeVisible();

  await page.goto("/sop");
  const monthInput = page.getByLabel("选择月份");
  await expect(monthInput).toHaveAttribute("type", "text");
  await expect(monthInput).toHaveAttribute("placeholder", "YYYY-MM");
  await monthInput.fill("2026-13");
  await page.getByRole("button", { name: "查看" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "请输入 YYYY-MM 格式的有效月份。" }),
  ).toBeVisible();

  await page.goto(`/milestones/${fixture.currentYearMonth}/report`);
  await expectChineseSurface(page);
  await expect(page.getByRole("heading", { name: /月度报告/ })).toBeVisible();
  await expect(page.getByText("¥500.00", { exact: true }).first()).toBeVisible();

  await page.goto("/coach");
  await expectChineseSurface(page, 2);
  await expect(page.getByRole("heading", { level: 2, name: "页面未找到" })).toBeVisible();

  await page.goto("/setup/complete");
  await expectChineseSurface(page);
  await expect(page.getByRole("heading", { level: 1, name: "储蓄起点已保存" })).toBeVisible();
  await expect(page.getByText("¥1,000.00", { exact: true }).first()).toBeVisible();
});
