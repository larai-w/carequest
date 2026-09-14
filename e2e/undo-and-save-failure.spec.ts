/**
 * 記録を消す・残すときに「気づかないうちに失われる」形を防ぐ回帰テスト。
 *
 * きっかけ: 2026-09-14 の /hci-check(予測評価)で見つかった候補。
 *   1. ふりかえり・ホームの × は、確認も取り消しも無くその場で記録が消えていた
 *   2. 記録の保存に失敗しても、ポイントと励ましは成功時と同じに見えていた
 *   4. 自分で追加したケアの × は、確認も取り消しも無く項目が消えていた
 *   5. 削除に失敗したとき「保存できませんでした」とだけ出て、記録が残っていることが伝わらなかった
 *
 * 方針: 確認ダイアログは挟まない(10秒ルール)。消した直後に「元に戻す」を出す。
 *
 * basePath: /carequest
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "/carequest";
const STORAGE_KEY = "carequest-state-v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    const raw = window.localStorage.getItem(key);
    const state: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(key, JSON.stringify({ ...state, onboardingShown: true, version: 6 }));
  }, STORAGE_KEY);
});

/** クエスト画面で「薬を渡した」を1件記録する(hydration 前のクリックに備えてリトライする)。 */
async function recordOne(page: Page) {
  await page.goto(`${BASE}/quest/`);
  await expect(async () => {
    await page.getByRole("button", { name: /薬を渡した/ }).click({ timeout: 2000 });
    await expect(page.locator('[aria-label="直前に記録した内容"]')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

/** 以後の localStorage への保存だけを失敗させる(読み込みは通す)。 */
async function failPersistence(page: Page) {
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === key) throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, k, v);
    };
  }, STORAGE_KEY);
}

async function storedLogCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? ((JSON.parse(raw) as { logs?: unknown[] }).logs?.length ?? 0) : 0;
  }, STORAGE_KEY);
}

test("ふりかえりの × で消した記録を、その場で元に戻せる", async ({ page }) => {
  await recordOne(page);
  await page.goto(`${BASE}/reflection/`);

  const deleteButton = page.locator('button[aria-label="薬を渡したの記録を取り消す"]');
  await expect(async () => {
    if ((await deleteButton.count()) > 0) await deleteButton.click({ timeout: 2000 });
    await expect(page.getByText("「薬を渡した」の記録を取り消しました")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  expect(await storedLogCount(page)).toBe(0);

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(deleteButton).toBeVisible();
  await expect(page.getByText("「薬を渡した」の記録を取り消しました")).toHaveCount(0);

  await page.reload();
  await expect(page.locator('button[aria-label="薬を渡したの記録を取り消す"]')).toBeVisible({ timeout: 10_000 });
  expect(await storedLogCount(page)).toBe(1);
});

test("ホームの × で消した記録を、その場で元に戻せる", async ({ page }) => {
  await recordOne(page);
  await page.goto(`${BASE}/`);

  const deleteButton = page.locator('button[aria-label="薬を渡したの記録を取り消す"]');
  await expect(async () => {
    if ((await deleteButton.count()) > 0) await deleteButton.click({ timeout: 2000 });
    await expect(page.getByText("「薬を渡した」の記録を取り消しました")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator("text=1件の介護を記録しました")).toBeVisible();
  await page.reload();
  await expect(page.locator("text=1件の介護を記録しました")).toBeVisible({ timeout: 10_000 });
});

test("自分で追加したケアを外しても、その場で元に戻せる", async ({ page }) => {
  await page.goto(`${BASE}/quest/`);
  const input = page.locator("#custom-task-input");
  await expect(async () => {
    await input.fill("夜中に3回起きた", { timeout: 2000 });
    await page.getByRole("button", { name: "追加", exact: true }).click({ timeout: 2000 });
    await expect(page.getByRole("button", { name: "夜中に3回起きたを削除" })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole("button", { name: "夜中に3回起きたを削除" }).click();
  await expect(page.getByText("「夜中に3回起きた」をクエストから外しました")).toBeVisible();
  await expect(page.getByRole("button", { name: "夜中に3回起きたを削除" })).toHaveCount(0);

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("button", { name: "夜中に3回起きたを削除" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "夜中に3回起きたを削除" })).toBeVisible({ timeout: 10_000 });
});

test("記録の保存に失敗したら、成功したようには見せない", async ({ page }) => {
  await page.goto(`${BASE}/quest/`);
  // hydration を待ってから保存だけを壊す。
  await expect(page.getByRole("button", { name: /薬を渡した/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await failPersistence(page);

  await page.getByRole("button", { name: /薬を渡した/ }).click();

  const failure = page.locator('[aria-label="記録を保存できませんでした"]');
  await expect(failure).toBeVisible();
  await expect(failure).toContainText("薬を渡した");
  await expect(page.locator('[aria-label="直前に記録した内容"]')).toHaveCount(0);
  await expect(page.locator("text=0件の介護を記録しました")).toBeVisible();
  await expect(page.getByText("0pt", { exact: true })).toBeVisible();
});

test("ふりかえりで削除に失敗したら、記録が残っていることを伝える", async ({ page }) => {
  await recordOne(page);
  await page.goto(`${BASE}/reflection/`);
  const deleteButton = page.locator('button[aria-label="薬を渡したの記録を取り消す"]');
  await expect(deleteButton).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  await failPersistence(page);

  await deleteButton.click();

  await expect(page.getByText("取り消しできませんでした。記録はそのまま残っています。")).toBeVisible();
  await expect(deleteButton).toBeVisible();
  await expect(page.getByText(/記録を保存できませんでした/)).toHaveCount(0);
  expect(await storedLogCount(page)).toBe(1);
});

// 2026-09-14 /hci-check 候補 #7: 記録画面の「取り消す」は、取り消した直後に戻せなかった。
test("記録画面で取り消した記録を、その場で元に戻せる", async ({ page }) => {
  await recordOne(page);

  await page.getByRole("button", { name: "直前の記録を取り消す" }).click();
  await expect(page.getByText("「薬を渡した」の記録を取り消しました")).toBeVisible();
  expect(await storedLogCount(page)).toBe(0);

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator('[aria-label="直前に記録した内容"]')).toContainText("薬を渡した");
  await expect(page.getByText("「薬を渡した」の記録を取り消しました")).toHaveCount(0);
  expect(await storedLogCount(page)).toBe(1);

  await page.reload();
  expect(await storedLogCount(page)).toBe(1);
});

// 2026-09-14 /hci-check 候補 #6: 震えで0.5秒以上あけて2回触れると、気づかないまま重複していた。
test("同じケアを続けて記録したら、確認カードで知らせる", async ({ page }) => {
  await recordOne(page);
  const card = page.locator('[aria-label="直前に記録した内容"]');
  await expect(card).not.toContainText("少し前にも同じ記録");

  await page.waitForTimeout(700); // 500ms の連打ガードを越える
  await page.getByRole("button", { name: /薬を渡した/ }).click();

  await expect(card).toContainText("少し前にも同じ記録が1件あります");
  expect(await storedLogCount(page)).toBe(2);
});
