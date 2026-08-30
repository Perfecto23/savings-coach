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
      response
        .text()
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
  await expect(page.getByRole("heading", { level: 1, name: "Build your Savings Plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add a Plan Rule" })).toBeVisible();
  await expect(page.getByText(fixture.otherOwnerCanary, { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Rule name").fill(fixture.ruleName);
  await page.getByLabel("Rule amount").fill("500");
  await page.getByLabel("Due day").fill("31");
  await expect(page.getByLabel("Source account (optional)")).toBeVisible();
  await expect(page.getByLabel("Target account")).toBeVisible();
  await page.getByRole("button", { name: "Add rule" }).dblclick();

  const rules = page.getByRole("region", { name: "Plan Rules" });
  await expect(rules.getByRole("listitem").filter({ hasText: fixture.ruleName })).toHaveCount(1);
  await expect(rules).toContainText("S$500.00");

  await page.goto("/settings");
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

  await page.getByRole("button", { name: "Activate Savings Plan" }).click();

  await expect(
    page.getByText(
      "A legacy monthly step conflicts with this Plan Rule. Review the month and try again.",
      { exact: true },
    ),
  ).toHaveCount(0);

  await expect(page.getByText("Your Savings Plan is active.", { exact: true })).toBeVisible();
  await expect(page.getByText(/You plan to move S\$500\.00 into .* each month\./)).toBeVisible();
  await expect(page.getByText(/^Your next action is due /)).toBeVisible();

  const currentActions = page.getByRole("region", { name: "Current month actions" });
  await expectCurrentAction(currentActions, fixture.ruleName, "S$500.00");

  const planPath = page.getByRole("region", { name: "Plan Path" });
  await expect(planPath.getByRole("listitem")).toHaveCount(12);
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page.getByText("Your Savings Plan is active.", { exact: true })).toBeVisible();
  await expect(rules.getByRole("listitem").filter({ hasText: fixture.ruleName })).toHaveCount(1);
  await expectCurrentAction(currentActions, fixture.ruleName, "S$500.00");
  await expect(planPath.getByRole("listitem")).toHaveCount(12);

  const ruleItem = rules.getByRole("listitem").filter({ hasText: fixture.ruleName });
  await ruleItem.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit a Plan Rule" })).toBeVisible();
  await page.getByLabel("Rule amount").fill("700");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expectCurrentAction(currentActions, fixture.ruleName, "S$500.00");
  const pathRowsAfterEdit = planPath.getByRole("listitem");
  await expect(pathRowsAfterEdit.nth(0)).toContainText("S$1,500.00");
  await expect(pathRowsAfterEdit.nth(1)).toContainText("S$2,200.00");

  await ruleItem.getByRole("button", { name: "Deactivate" }).click();
  await expectCurrentAction(currentActions, fixture.ruleName, "S$500.00");
  await expect(planPath.getByRole("listitem").nth(1)).toContainText("S$1,500.00");
  await expect(ruleItem.getByRole("button", { name: "Reactivate" })).toBeVisible();

  await ruleItem.getByRole("button", { name: "Reactivate" }).click();
  await expect(planPath.getByRole("listitem").nth(1)).toContainText("S$2,200.00");
  await expectNoHorizontalOverflow(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "This month" })).toBeVisible();
  const nextAction = page.getByRole("region", { name: "Next Monthly Action" });
  await expect(nextAction).toContainText(fixture.ruleName);
  await expect(nextAction).toContainText("S$500.00");
  await expect(nextAction).toContainText("Savings Coach does not move money");
  await expectNoHorizontalOverflow(page);

  await page
    .getByRole("button", { name: `Confirm completion for ${fixture.ruleName}` })
    .click();
  await expect(page.getByRole("heading", { name: "Your plan is now in motion." })).toBeVisible();
  const progress = page.getByRole("region", { name: "Monthly Action progress" });
  await expect(progress).toContainText("1 of 1");
  await expect(page.getByRole("heading", { name: "This month’s Monthly Actions are complete." })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "This month’s Monthly Actions are complete." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your plan is now in motion." })).toHaveCount(0);
  await page
    .getByRole("button", { name: `Undo confirmation for ${fixture.ruleName}` })
    .click();
  await expect(page.getByRole("region", { name: "Next Monthly Action" })).toContainText(fixture.ruleName);
  await expectNoHorizontalOverflow(page);

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
