import { test, expect } from "@playwright/test";

test("account deletion instructions are available without login or installation", async ({ page }) => {
  // Read-only: never submit a request or operate on an account.
  await page.goto("/carequest/delete-account/");
  await expect(page.getByRole("heading", { name: "Care Quest アカウントとデータの削除" })).toBeVisible();
  await expect(page.getByRole("link", { name: "メールで削除を依頼する" })).toHaveAttribute(
    "href", /^mailto:care_q@veai\.jp\?subject=/,
  );
  await expect(page.getByText("パスワードや認証コード、介護記録の内容は送らないでください。")).toBeVisible();
  await page.goto("/carequest/privacy/");
  await expect(page.getByRole("link", { name: "アカウントとデータの削除方法" })).toHaveAttribute(
    "href", "/carequest/delete-account/",
  );
});
