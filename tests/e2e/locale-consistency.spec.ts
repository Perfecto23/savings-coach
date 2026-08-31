import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface LocaleFixture {
  email: string;
  password: string;
  currentYearMonth: string;
  expectedLocale: "zh-CN" | "en-SG";
  expectedCurrency: "CNY" | "SGD";
  otherOwnerCanary: string;
  secretCanary: string;
}

const fixturePath = path.join(
  "/tmp/savings-coach-locale-e2e",
  "fixtures.json",
);

function loadFixture(projectName: string): LocaleFixture {
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<
    string,
    LocaleFixture
  >;
  const fixture = fixtures[projectName];

  if (!fixture?.expectedLocale || !fixture.currentYearMonth) {
    throw new Error(`Missing Locale E2E fixture for ${projectName}`);
  }

  return fixture;
}

const ZH_FORBIDDEN_COPY = [
  "Build your Savings Plan",
  "Set a monthly intention",
  "Add a Plan Rule",
  "Turn rules into this month's actions",
  "Current month actions",
  "Activate your Savings Plan",
  "Activate Savings Plan",
  "Open Savings Plan",
  "Your next Monthly Action",
  "Monthly Action progress",
  "Balance Snapshots",
  "Record Balance Snapshots",
  "Observation date",
  "Save Balance Snapshots",
  "Progress",
  "Monthly report",
  "Monthly Review",
  "Impulse Check",
  "No Source Account",
];

const EN_FORBIDDEN_COPY = [
  "仪表盘",
  "首页",
  "储蓄计划",
  "月度 SOP",
  "余额记录",
  "收入管理",
  "里程碑",
  "冲动拦截",
  "设置",
  "退出登录",
  "本月",
  "月度报告",
];

function isMobileProject(projectName: string) {
  return projectName.startsWith("mobile-");
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return root.scrollWidth > root.clientWidth || body.scrollWidth > body.clientWidth;
  });

  expect(hasHorizontalOverflow).toBe(false);
}

async function signIn(page: Page, fixture: LocaleFixture) {
  await page.goto("/login");
  await page.getByLabel(/^(Email|邮箱)$/).fill(fixture.email);
  await page.getByLabel(/^(Password|密码)$/).fill(fixture.password);
  await page.getByRole("button", { name: /^(Log in|登录)$/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectShell(page: Page, isChinese: boolean, isMobile: boolean) {
  if (isMobile) {
    await expect(
      page.getByRole("link", { name: isChinese ? /^首页$/ : /^(Home|Dashboard)$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: isChinese ? /^计划$/ : /^Plan$/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^SOP$/ })).toBeVisible();
    await expect(
      page.getByRole("link", { name: isChinese ? /余额/ : /Balance/ }),
    ).toBeVisible();

    const moreButton = page.getByRole("button", {
      name: isChinese ? /^更多$/ : /^More$/,
    });
    await expect(moreButton).toBeVisible();
    await moreButton.click();
    await expect(
      page.getByRole("link", { name: isChinese ? /^收入管理$/ : /^(Income|Income management)$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: isChinese ? /^里程碑$/ : /^Progress$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: isChinese ? /^冲动拦截$/ : /^Impulse Check$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: isChinese ? /^设置$/ : /^Settings$/ }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: isChinese
          ? /关闭更多(菜单|导航)/
          : /Close more (menu|navigation)/,
      })
      .click();
    return;
  }

  await expect(
    page.getByRole("link", { name: isChinese ? /^(仪表盘|首页)$/ : /^(Dashboard|Home)$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: isChinese ? /^(储蓄计划|计划)$/ : /^Savings Plan$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: isChinese ? /^月度 SOP$/ : /^Monthly SOP$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: isChinese ? /^余额记录$/ : /^Balance Snapshots$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: isChinese ? /^收入管理$/ : /^Income$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: isChinese ? /^里程碑$/ : /^Progress$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: isChinese ? /^冲动拦截$/ : /^Impulse Check$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: isChinese ? /^设置$/ : /^Settings$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: isChinese ? "退出登录" : /Log out|Sign out/ }),
  ).toBeVisible();
}

async function expectLocalizedSurface(
  page: Page,
  fixture: LocaleFixture,
  isChinese: boolean,
  checkDocumentLocale = true,
  headingLevel: 1 | 2 = 1,
) {
  if (checkDocumentLocale) {
    await expect
      .poll(() => page.evaluate(() => document.documentElement.lang))
      .toBe(fixture.expectedLocale);
  }

  const localizedRoot = page.locator(`[lang="${fixture.expectedLocale}"]:not(html)`).first();
  await expect(localizedRoot).toBeVisible();

  const heading = page.getByRole("heading", { level: headingLevel }).first();
  await expect(heading).toBeVisible();
  const headingText = await heading.innerText();
  if (isChinese) {
    expect(headingText).toMatch(/[\u3400-\u9fff]/u);
  } else {
    expect(headingText).toMatch(/[A-Za-z]/);
  }

  const visibleText = await page.locator("body").innerText();
  const forbiddenCopy = isChinese ? ZH_FORBIDDEN_COPY : EN_FORBIDDEN_COPY;
  for (const forbidden of forbiddenCopy) {
    expect(visibleText).not.toContain(forbidden);
  }

  await expectNoHorizontalOverflow(page);
}

test("authenticated product surfaces follow the owner locale", async ({ page }, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);
  const isChinese = fixture.expectedLocale === "zh-CN";
  const isMobile = isMobileProject(testInfo.project.name);

  await signIn(page, fixture);

  await page.context().clearCookies({ name: "savings-coach-locale" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", fixture.expectedLocale);
  await expect(page).toHaveTitle(
    isChinese
      ? "储蓄教练 — 你的个人储蓄伙伴"
      : "Savings Coach — Your personal savings companion",
  );

  await expectShell(page, isChinese, isMobile);
  await expectLocalizedSurface(page, fixture, isChinese);

  await page.goto("/plan");
  await expectLocalizedSurface(page, fixture, isChinese);

  const planLabels = isChinese
    ? {
        ruleName: /规则名称|规则名/,
        amount: /规则金额/,
        dueDay: /执行日|到期日/,
        source: /来源账户/,
        target: /目标账户/,
        addRule: /添加.*规则/,
        activate: /激活.*储蓄计划/,
      }
    : {
        ruleName: /^Rule name$/,
        amount: /^Rule amount$/,
        dueDay: /^Due day$/,
        source: /^Source account \(optional\)$/,
        target: /^Target account$/,
        addRule: /^Add rule$/,
        activate: /^Activate Savings Plan$/,
      };

  await expect(page.getByLabel(planLabels.ruleName)).toBeVisible();
  await expect(page.getByLabel(planLabels.amount)).toBeVisible();
  await expect(page.getByLabel(planLabels.dueDay)).toBeVisible();
  await expect(page.getByLabel(planLabels.source)).toBeVisible();
  await expect(page.getByLabel(planLabels.target)).toBeVisible();

  if (process.env.CAPTURE_LOCALE_REVIEW === "1" && isChinese && !isMobile) {
    const reviewDirectory = path.resolve(".impeccable/review");
    fs.mkdirSync(reviewDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(reviewDirectory, "locale-plan-desktop.png"),
      fullPage: true,
    });
  }

  const ruleName = isChinese ? "每月储蓄" : "Monthly savings";
  await page.getByLabel(planLabels.ruleName).fill(ruleName);
  await page.getByLabel(planLabels.amount).fill("500");
  await page.getByLabel(planLabels.dueDay).fill("28");
  await page.getByRole("button", { name: planLabels.addRule }).click();
  await expect(page.getByText(ruleName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: planLabels.activate }).click();
  await expect(
    page.getByText(
      isChinese ? /你的储蓄计划已激活/ : /Your Savings Plan is active\./,
    ),
  ).toBeVisible();
  await expectLocalizedSurface(page, fixture, isChinese);

  const expectedAmount = isChinese ? "¥500.00" : "S$500.00";
  await expect(page.getByText(expectedAmount, { exact: true }).first()).toBeVisible();
  const planText = await page.locator("body").innerText();
  if (isChinese) {
    expect(planText).toMatch(/\d{1,2}月\d{1,2}日/u);
  } else {
    expect(planText).toMatch(/\d{1,2}\s+[A-Za-z]{3,9}/);
  }

  const routes = [
    "/",
    "/plan",
    "/sop",
    "/balances",
    "/income",
    "/milestones",
    "/impulse",
    "/settings",
    `/milestones/${fixture.currentYearMonth}/report`,
    "/coach",
    "/setup/complete",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expectLocalizedSurface(
      page,
      fixture,
      isChinese,
      route !== "/setup/complete",
      route === "/coach" ? 2 : 1,
    );

    if (route === "/coach") {
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: isChinese ? "页面未找到" : "Page not found",
        }),
      ).toBeVisible();
    }

    if (route === "/") {
      await expect(
        page.getByRole("region", {
          name: isChinese ? /^下一.*行动$/ : "Next Monthly Action",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: isChinese ? /确认.*完成/ : /Confirm completion for/,
        }),
      ).toBeVisible();
    }

    if (route === "/impulse") {
      await expect(
        page.getByLabel(isChinese ? /拦截金额/ : /Impulse amount \(SGD\)/),
      ).toBeVisible();
    }

    if (route !== "/setup/complete") {
      await expectShell(page, isChinese, isMobile);
    }
  }
});
