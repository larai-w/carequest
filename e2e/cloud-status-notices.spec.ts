/**
 * クラウド控えの状態を、案内した場所で見せる回帰テスト。
 *
 * きっかけ: 2026-09-14 の /hci-check「直した後の歩き直し」(予測評価)で見つかった候補。
 *   2. 記録画面は「ホームの『アカウント』で確かめて」と案内するのに、ホームに選ぶ欄が出なかった
 *   3. 送る側のボタンが宣言の形で、ログアウトと同じ見た目・先に並んでいた
 *   4. クラウドの記録を削除した後、自動の控えを止めた状態が記録画面では何も見えなかった
 *
 * ログイン操作そのもの(Cognito)は E2E に無いので、端末の印(localStorage)を置いて画面だけを見る。
 * ホームはマウント時に認証 SDK を読まず、印だけで表示を決める(T45)。
 *
 * basePath: /carequest
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "/carequest";
const STORAGE_KEY = "carequest-state-v1";
const SIGNED_IN_FLAG_KEY = "carequest-signed-in-v1";
const OWNER_CONFLICT_KEY = "carequest-owner-conflict-v1";
const PAUSED_KEY = "carequest-cloud-auto-paused-v1";

async function seed(page: Page, extra: Record<string, string>) {
  await page.addInitScript(
    ({ key, extra }) => {
      const raw = window.localStorage.getItem(key);
      const state: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(key, JSON.stringify({ ...state, onboardingShown: true, version: 6 }));
      for (const [k, v] of Object.entries(extra)) {
        window.localStorage.setItem(k, v);
      }
    },
    { key: STORAGE_KEY, extra },
  );
}

test("別のアカウントの記録がある端末では、ホームを開いただけで選ぶ欄が出て、ログアウトが先に並ぶ", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { [SIGNED_IN_FLAG_KEY]: "1", [OWNER_CONFLICT_KEY]: "1" });
  await page.goto(`${BASE}/`);

  const send = page.getByRole("button", { name: "この端末の記録を、このアカウントのクラウドへ送る" });
  const logout = page.getByRole("button", { name: "ログアウトする" });
  await expect(send).toBeVisible({ timeout: 15_000 });
  await expect(logout).toBeVisible();

  const sendBox = await send.boundingBox();
  const logoutBox = await logout.boundingBox();
  expect(sendBox && logoutBox).toBeTruthy();
  if (sendBox && logoutBox) {
    // ログアウトが先(上、または同じ行の左)
    const logoutFirst = logoutBox.y + 1 < sendBox.y || (Math.abs(logoutBox.y - sendBox.y) <= 1 && logoutBox.x < sendBox.x);
    expect(logoutFirst).toBe(true);
    // 震える指でも押せる高さ(44px)
    expect(sendBox.height).toBeGreaterThanOrEqual(44);
    expect(logoutBox.height).toBeGreaterThanOrEqual(44);
  }
  // 390px 幅で横にはみ出さない
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("印が無ければ、ホームに選ぶ欄は出ない", async ({ page }) => {
  await seed(page, { [SIGNED_IN_FLAG_KEY]: "1" });
  await page.goto(`${BASE}/`);
  await expect(page.getByRole("button", { name: "ログアウト", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "この端末の記録を、このアカウントのクラウドへ送る" })).toHaveCount(0);
});

test("自動の控えを止めている間は、記録した確認カードにそのことと再開のしかたが出る", async ({ page }) => {
  await seed(page, { [PAUSED_KEY]: "1" });
  await page.goto(`${BASE}/quest/`);
  await expect(async () => {
    await page.getByRole("button", { name: /薬を渡した/ }).click({ timeout: 2000 });
    await expect(page.locator('[aria-label="直前に記録した内容"]')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });

  const card = page.locator('[aria-label="直前に記録した内容"]');
  await expect(card).toContainText("自動でクラウドへ控えるのは止めています");
  await expect(card).toContainText("クラウドにバックアップ");
});

test("止めていなければ、確認カードに止めている知らせは出ない", async ({ page }) => {
  await seed(page, {});
  await page.goto(`${BASE}/quest/`);
  await expect(async () => {
    await page.getByRole("button", { name: /薬を渡した/ }).click({ timeout: 2000 });
    await expect(page.locator('[aria-label="直前に記録した内容"]')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.locator('[aria-label="直前に記録した内容"]')).not.toContainText("止めています");
});
