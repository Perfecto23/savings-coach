import { expect, test } from "@playwright/test";

test("login page exposes the expected responsive sign-in interface", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveTitle("Savings Coach — Your personal savings companion");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByRole("heading", { level: 1, name: "Savings Coach" })).toBeVisible();

  const email = page.getByLabel("Email");
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("required", "");
  await expect(email).toHaveAttribute("autocomplete", "email");

  const password = page.getByLabel("Password");
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveAttribute("required", "");
  await expect(password).toHaveAttribute("autocomplete", "current-password");

  const loginButton = page.getByRole("button", { name: "Log in" });
  await expect(loginButton).toBeVisible();
  await loginButton.click();
  await expect(email).toBeFocused();
  await expect(page).toHaveURL(/\/login$/);

  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return root.scrollWidth > root.clientWidth || body.scrollWidth > body.clientWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);
});
