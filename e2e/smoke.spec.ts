/**
 * Care Quest スモークテスト
 *
 * 主要3フローを検証する:
 *   1. クエストで記録 → リロード後も記録が残る
 *   2. 休息モードをホームからオン/オフできる
 *   3. ふりかえり画面から JSON をエクスポートできる
 *
 * basePath: /carequest  (next.config.ts の basePath 設定に準拠)
 */

import { test, expect } from "@playwright/test";

const BASE = "/carequest";

// オンボーディングカードを事前に「表示済み」にして UI をクリアにする。
// addInitScript はページの JS より前に実行されるため、React の初期化より早く
// localStorage が設定される。
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const STORAGE_KEY = "carequest-state-v1";
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const state: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, onboardingShown: true, version: 4 }),
    );
  });
});

test("クエストで記録したタスクがリロード後も残る", async ({ page }) => {
  // クエスト画面を開く
  await page.goto(`${BASE}/quest/`);

  // 最初のタスクカードをクリックして記録する
  const taskButton = page.locator('button[class*="rounded-\\[24px\\]"]').first();
  await taskButton.click();

  // クエスト画面に「1件の介護を記録しました」と表示されるまで待つ
  await expect(page.locator("text=1件の介護を記録しました")).toBeVisible();

  // ホームへ移動してリロードする
  await page.goto(`${BASE}/`);
  await page.reload();

  // リロード後もホームに記録が残っている
  await expect(page.locator("text=1件の介護を記録しました")).toBeVisible();
});

test("ホームから休息モードをオン/オフできる", async ({ page }) => {
  await page.goto(`${BASE}/`);

  // 「今日は無理しない」ボタンでおやすみモードに入る
  await page.click("button:has-text('今日は無理しない')");

  // おやすみモード画面が表示される
  await expect(page.locator("text=おやすみモード中")).toBeVisible();

  // 「通常モードにもどる」で通常ホームに戻る
  await page.click("button:has-text('通常モードにもどる')");

  // 通常ホーム画面の「今日の記録」見出しが表示される
  await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();
});

test("ふりかえり画面から JSON をエクスポートできる", async ({ page }) => {
  await page.goto(`${BASE}/reflection/`);

  // ダウンロードイベントを待ちながらエクスポートボタンをクリックする
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("button:has-text('自分の記録を保存する')"),
  ]);

  // ファイル名が carequest-export-*.json の形式
  expect(download.suggestedFilename()).toMatch(/^carequest-export-\d{4}-\d{2}-\d{2}\.json$/);
});
