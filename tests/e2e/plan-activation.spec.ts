import { expect, test, type Locator, type Page, type Response } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface PlanFixture {
  email: string;
  password: string;
  ruleName: string;
  otherOwnerCanary: string;
  secretCanary: string;
}

const fixturePath = path.resolve(".setup-e2e/plan/fixtures.json");

function loadFixture(projectName: string): PlanFixture {
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<
    string,
    PlanFixture
  >;
  const fixture = fixtures[projectName];

  if (!fixture) {
    throw new Error(`Missing Plan E2E fixture for ${projectName}`);
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
          // Redirects and interrupted navigations may not expose a body.
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

async function expectCurrentAction(
  currentActions: Locator,
  ruleName: string,
  amount: string,
) {
  const action = currentActions.getByRole("listitem").filter({ hasText: ruleName });
  await expect(action).toHaveCount(1);
  await expect(action).toContainText(amount);
}

test("an invited owner activates and safely changes a Savings Plan without income data", async ({
  page,
}, testInfo) => {
  const fixture = loadFixture(testInfo.project.name);
  const captured = captureRscAndHtml(page);

  await page.goto("/login");
  await page.getByLabel("邮箱").fill(fixture.email);
  await page.getByLabel("密码").fill(fixture.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/plan");
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole("heading", { level: 1, name: "建立你的储蓄计划" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "添加计划规则" })).toBeVisible();
  await expect(page.getByText(fixture.otherOwnerCanary, { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("规则名称").fill(fixture.ruleName);
  await page.getByLabel("规则金额").fill("500");
  await page.getByLabel("到期日").fill("31");
  await expect(page.getByLabel("来源账户（可选）")).toBeVisible();
  await expect(page.getByLabel("目标账户")).toBeVisible();
  await page.getByRole("button", { name: "添加规则" }).dblclick();

  const rules = page.getByRole("region", { name: "计划规则" });
  await expect(rules.getByRole("listitem").filter({ hasText: fixture.ruleName })).toHaveCount(1);
  await expect(rules).toContainText("¥500.00");

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "SOP 模板" }).click();
  await expect(page.getByText(fixture.ruleName, { exact: true })).toHaveCount(0);

  await page.goto("/plan");
  await expect(rules.getByRole("listitem").filter({ hasText: fixture.ruleName })).toHaveCount(1);

  await page.goto("/sop");
  await expect(page.getByRole("heading", { level: 1, name: "月度 SOP" })).toBeVisible();
  const initializedLegacyRule = page.getByText(fixture.ruleName, { exact: true });
  const emptyLegacyMonth = page.getByText(/还没有 SOP 模板/);
  await expect(initializedLegacyRule.or(emptyLegacyMonth)).toBeVisible();

  await page.goto("/plan");
  await expect(rules.getByRole("listitem").filter({ hasText: fixture.ruleName })).toHaveCount(1);

  await page.getByRole("button", { name: "激活储蓄计划" }).click();

  await expect(
    page.getByText(
      "无法激活储蓄计划。请重试。",
      { exact: true },
    ),
  ).toHaveCount(0);

  await expect(page.getByText("你的储蓄计划已激活。", { exact: true })).toBeVisible();
  await expect(page.getByText(/你计划每月向 .* 转入 ¥500\.00。/)).toBeVisible();
  await expect(page.getByText(/^下一项行动的到期日是 /)).toBeVisible();

  const currentActions = page.getByRole("region", { name: "本月行动" });
  await expectCurrentAction(currentActions, fixture.ruleName, "¥500.00");

  const planPath = page.getByRole("region", { name: "计划路径" });
  await expect(planPath.getByRole("listitem")).toHaveCount(12);
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page.getByText("你的储蓄计划已激活。", { exact: true })).toBeVisible();
  await expect(rules.getByRole("listitem").filter({ hasText: fixture.ruleName })).toHaveCount(1);
  await expectCurrentAction(currentActions, fixture.ruleName, "¥500.00");
  await expect(planPath.getByRole("listitem")).toHaveCount(12);

  const ruleItem = rules.getByRole("listitem").filter({ hasText: fixture.ruleName });
  await ruleItem.getByRole("button", { name: "编辑" }).click();
  await expect(page.getByRole("heading", { name: "编辑计划规则" })).toBeVisible();
  await page.getByLabel("规则金额").fill("700");
  await page.getByRole("button", { name: "保存修改" }).click();

  await expectCurrentAction(currentActions, fixture.ruleName, "¥500.00");
  const pathRowsAfterEdit = planPath.getByRole("listitem");
  await expect(pathRowsAfterEdit.nth(0)).toContainText("¥1,500.00");
  await expect(pathRowsAfterEdit.nth(1)).toContainText("¥2,200.00");

  await ruleItem.getByRole("button", { name: "停用" }).click();
  await expectCurrentAction(currentActions, fixture.ruleName, "¥500.00");
  await expect(planPath.getByRole("listitem").nth(1)).toContainText("¥1,500.00");
  await expect(ruleItem.getByRole("button", { name: "重新启用" })).toBeVisible();

  await ruleItem.getByRole("button", { name: "重新启用" }).click();
  await expect(planPath.getByRole("listitem").nth(1)).toContainText("¥2,200.00");
  await expectNoHorizontalOverflow(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "本月" })).toBeVisible();
  const nextAction = page.getByRole("region", { name: "下一月度行动" });
  await expect(nextAction).toContainText(fixture.ruleName);
  await expect(nextAction).toContainText("¥500.00");
  await expect(nextAction).toContainText("储蓄教练不转移资金");
  await expectNoHorizontalOverflow(page);

  await page
    .getByRole("button", { name: `确认已完成${fixture.ruleName}` })
    .click();
  await expect(page.getByRole("heading", { name: "储蓄计划已经开始执行。" })).toBeVisible();
  const progress = page.getByRole("region", { name: "月度行动进度" });
  await expect(progress).toContainText("已确认 1/1 个月度行动");
  await expect(page.getByRole("heading", { name: "本月行动已全部完成。" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "本月行动已全部完成。" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "储蓄计划已经开始执行。" })).toHaveCount(0);
  await page
    .getByRole("button", { name: `撤销${fixture.ruleName}的完成确认` })
    .click();
  await expect(page.getByRole("region", { name: "下一月度行动" })).toContainText(fixture.ruleName);
  await expectNoHorizontalOverflow(page);

  await page.goto("/balances");
  await expect(page.getByRole("heading", { level: 1, name: "余额快照" })).toBeVisible();
  await expect(page.getByText("¥1,000.00", { exact: true })).toBeVisible();
  await expect(page.getByText(/储蓄教练不验证银行余额/)).toBeVisible();
  await page.getByLabel(/余额快照/).first().fill("1100");
  await page.getByRole("button", { name: "保存余额快照" }).click();
  await expect(page.getByText(/余额快照已保存/)).toBeVisible();

  await page.goto("/milestones");
  await expect(page.getByRole("heading", { level: 1, name: "进展" })).toBeVisible();
  await expect(page.getByText("¥500.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("¥1,500.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("¥1,100.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("净值偏差", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "打开月度报告" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: /月度报告/ })).toBeVisible();
  await expect(page.getByText("最早余额快照", { exact: true })).toBeVisible();
  await expect(page.getByText("最新余额快照", { exact: true })).toBeVisible();
  await expect(page.getByText("¥1,100.00", { exact: true }).first()).toBeVisible();

  await page.goto("/sop");
  await expect(
    page.getByText(/月度行动金额: ¥500\.00/, { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑" }).first().click();
  await expect(page.getByLabel("月度行动金额")).toBeVisible();
  await expect(page.getByText(/不会记录实际银行转账/)).toBeVisible();

  await page.goto("/impulse");
  await expect(page.getByRole("heading", { level: 1, name: "冲动拦截" })).toBeVisible();
  await expect(page.getByLabel("拦截金额（CNY）")).toBeVisible();
  await expect(
    page.getByText("记录你决定不买物品的预估价格。该金额不是已确认储蓄。", { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tab", { name: "邮件提醒" })).toHaveCount(0);
  await expect(page.getByText("管理账户和 SOP 模板。", { exact: true })).toBeVisible();

  const responsePayload = await captured.read();
  for (const forbiddenValue of [
    "owner_id",
    "api_key",
    "template_id",
    "step_key",
    "is_plan_rule",
    "is_monthly_action",
    "behavior_activated_at",
    fixture.otherOwnerCanary,
    fixture.secretCanary,
  ]) {
    expect(responsePayload).not.toContain(forbiddenValue);
  }
});
