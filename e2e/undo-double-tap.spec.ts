/**
 * 「取り消す」と「元に戻す」が同じ場所で入れ替わるときの、2回触れによる行き来を防ぐ回帰テスト。
 *
 * きっかけ: 2026-09-14 の /hci-check「直した後の歩き直し」(予測評価)候補 #6。
 *   記録画面で「取り消す」を押すと、ほぼ同じ場所に同じ見た目の「元に戻す」が出る。
 *   手の震えで2回触れると、取り消した直後に元に戻ってしまう(逆も)。
 *
 * 人の2回触れを、同じ座標への素早い2回クリックで再現する。
 *
 * 2026-09-14 時点(390px・Chromium)では、変更前のコードでも両方とも成功した
 * (2つのボタンは同じ位置に来ない)。押せない時間を足す修正は入れず、
 * 確認カードや「元に戻す」の高さが変わって位置が重なったときに気づくための見張りとして置く。
 *
 * basePath: /carequest
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "/carequest";
const STORAGE_KEY = "carequest-state-v1";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((key) => {
    const raw = window.localStorage.getItem(key);
    const state: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(key, JSON.stringify({ ...state, onboardingShown: true, version: 6 }));
  }, STORAGE_KEY);
});

async function recordOne(page: Page) {
  await page.goto(`${BASE}/quest/`);
  await expect(async () => {
    await page.getByRole("button", { name: /薬を渡した/ }).click({ timeout: 2000 });
    await expect(page.locator('[aria-label="直前に記録した内容"]')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

async function storedLogCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? ((JSON.parse(raw) as { logs?: unknown[] }).logs?.length ?? 0) : 0;
  }, STORAGE_KEY);
}

/** ボタンの中心を、間を空けずに2回押す。 */
async function doubleTouch(page: Page, name: string | RegExp) {
  const box = await page.getByRole("button", { name }).boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
}

test("「取り消す」の位置に2回触れても、取り消したままで、元に戻らない", async ({ page }) => {
  await recordOne(page);
  await doubleTouch(page, "直前の記録を取り消す");

  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
  await expect(page.locator('[aria-label="直前に記録した内容"]')).toHaveCount(0);
  expect(await storedLogCount(page)).toBe(0);
});

test("「元に戻す」の位置に2回触れても、戻したままで、また取り消されない", async ({ page }) => {
  await recordOne(page);
  await page.getByRole("button", { name: "直前の記録を取り消す" }).click();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
  await doubleTouch(page, "元に戻す");

  await expect(page.locator('[aria-label="直前に記録した内容"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "元に戻す" })).toHaveCount(0);
  expect(await storedLogCount(page)).toBe(1);
});
