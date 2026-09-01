import { expect, test } from "@playwright/test";

test("consumer AI and public signup stay closed", async ({ page, request }) => {
  const response = await request.post("/api/chat", {
    data: { conversationId: "probe", message: "probe" },
  });

  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({
    error: {
      code: "feature_disabled",
      message: "AI 教练在当前版本未开放。",
    },
  });

  await page.goto("/login");
  await expect(page.getByRole("link", { name: /注册/ })).toHaveCount(0);
});
