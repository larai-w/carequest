/**
 * Care Quest データ操作フロー回帰防止テスト (T44)
 *
 * 対象フロー:
 *   1. 記録削除: クエストで1件記録 → ホームで × で削除 → 0pt に戻る → リロード後も消えたまま
 *   2. 全削除: 記録を作る → ふりかえりの全削除導線 → 1段階目(エクスポート提案確認) →
 *              2段階目で確定 → オンボーディングカード(aria-label「はじめてのかたへ」)が
 *              再表示される → リロード後も初期状態
 *   3. バックアップリマインド: 記録20件+lastExportDate 31日前 を注入 →
 *              ふりかえりにカード表示 → 「とじる」で消える
 *   3b. 境界テスト: 記録19件では出ない
 *
 * basePath: /carequest  (next.config.ts の basePath 設定に準拠)
 */

import { test, expect } from "@playwright/test";

const BASE = "/carequest";

// ---------------------------------------------------------------------------
// 共通ヘルパー
// ---------------------------------------------------------------------------

/** ブラウザ内で実行できる YYYY-MM-DD 生成関数(addInitScript 用) */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Node 側で n 日前の YYYY-MM-DD を返す */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
}

/** today の文字列 */
function today(): string {
  return formatLocalDate(new Date());
}

// ---------------------------------------------------------------------------
// テスト 1: 記録削除
// ---------------------------------------------------------------------------

test.describe("記録削除", () => {
  // onboardingShown: true を注入してオンボーディングを非表示に。
  // smoke.spec.ts と同じ方式: 既存の状態に上書きマージして記録が消えないようにする。
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const STORAGE_KEY = "carequest-state-v1";
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const state: Record<string, unknown> = raw
        ? (JSON.parse(raw) as Record<string, unknown>)
        : {};
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, onboardingShown: true, version: 6 }),
      );
    });
  });

  test("クエストで記録 → ホームで × 削除 → 0pt → リロード後も消えたまま", async ({
    page,
  }) => {
    // --- クエストで1件記録する ---
    await page.goto(`${BASE}/quest/`);

    const taskButton = page.locator('button[class*="rounded-\\[24px\\]"]').first();
    await taskButton.click();
    await expect(page.locator("text=1件の介護を記録しました")).toBeVisible({ timeout: 5000 });

    // --- ホームへ移動 ---
    await page.goto(`${BASE}/`);

    // 記録がホームに表示されるまで待つ(hydration 後に表示される)。
    await expect(page.locator("text=1件の介護を記録しました")).toBeVisible({ timeout: 10000 });

    // 記録タイトルを取得して × ボタンを特定する。
    // aria-label が「◯◯の記録を取り消す」形式のボタンを探す。
    const deleteButton = page.locator('button[aria-label$="の記録を取り消す"]').first();

    // hydration レース対策: smoke.spec.ts の休息モードパターンに準拠。
    // クリック → 件数が 0 件になるまでリトライする。
    // ※ 削除後は削除ボタンが消えるため、2 回目以降は click タイムアウトになるが、
    //   それより先に "0件" が表示されれば toPass は成功する。
    await expect(async () => {
      // ボタンがまだ存在するときだけクリックする。
      const count = await deleteButton.count();
      if (count > 0) {
        await deleteButton.click({ timeout: 2000 });
      }
      await expect(page.locator("text=0件の介護を記録しました")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    // 削除後、ポイント表示が 0pt になっている。
    // ホームの「今日の自分のポイント」セクションにある pt テキストを確認する。
    await expect(page.locator("text=0pt")).toBeVisible({ timeout: 3000 });

    // --- リロード後も消えたまま ---
    await page.reload();
    await expect(page.locator("text=0件の介護を記録しました")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=0pt")).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// テスト 2: 全削除
// ---------------------------------------------------------------------------

test.describe("全削除", () => {
  test("記録を作る → 全削除の2段階確認 → オンボーディングが再表示される → リロード後も初期状態", async ({
    browser,
  }) => {
    // addInitScript のスコープ問題を避けるため、同一コンテキストで2ページを使う。
    // (リロード後の確認ページには注入を走らせない)
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    try {
      const page = await context.newPage();

      // --- 準備: onboardingShown: true で開始(オンボーディング非表示) ---
      await page.addInitScript(() => {
        const STORAGE_KEY = "carequest-state-v1";
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 6, onboardingShown: true }),
        );
      });

      // --- クエストで1件記録する ---
      await page.goto(`${BASE}/quest/`);
      const taskButton = page.locator('button[class*="rounded-\\[24px\\]"]').first();
      await taskButton.click();
      await expect(page.locator("text=1件の介護を記録しました")).toBeVisible({ timeout: 5000 });

      // --- ふりかえりへ移動 ---
      await page.goto(`${BASE}/reflection/`);

      // 全削除ボタンを表示するまでスクロールしてクリックする。
      // aria-label「すべての記録を削除する」で特定。
      const resetButton = page.locator('[aria-label="すべての記録を削除する"]');
      await resetButton.scrollIntoViewIfNeeded();

      // hydration レース対策: クリック → 1段階目のカード(エクスポート提案文言)が表示されるまでリトライ。
      await expect(async () => {
        await resetButton.click({ timeout: 2000 });
        // 1段階目のカード: エクスポート提案の文言が見える。
        await expect(
          page.locator("text=これまでの記録は、先に手元に書き出しておくこともできます。"),
        ).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15_000 });

      // 2段階目: 「すべて削除する」ボタンをクリックする。
      await page.click("button:has-text('すべて削除する')");

      // 削除完了メッセージが表示される。
      await expect(
        page.locator("text=まっさらになりました。"),
      ).toBeVisible({ timeout: 5000 });

      await page.close();

      // --- リロード後の確認(addInitScript なし = 実際の localStorage を読む) ---
      const page2 = await context.newPage();
      await page2.goto(`${BASE}/`);

      // 削除後は onboardingShown も初期化されているため、オンボーディングカードが再表示される。
      const onboardingCard = page2.locator('[aria-label="はじめてのかたへ"]');
      await expect(onboardingCard).toBeVisible({ timeout: 5000 });

      await page2.close();
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// テスト 3: バックアップリマインド
// ---------------------------------------------------------------------------

test.describe("バックアップリマインド", () => {
  /**
   * n 件の今日の CareLog を生成するヘルパー。
   * addInitScript 内(ブラウザ)で使うため、シリアライズ可能な配列を返す。
   */
  function makeLogs(count: number, dateStr: string) {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-log-${i}`,
      taskId: `task-${i}`,
      title: `テスト記録${i}`,
      points: 10,
      completedAt: new Date().toISOString(),
      date: dateStr,
      energyLevel: "normal",
    }));
  }

  test("記録20件+lastExportDate 31日前 → バックアップリマインドカードが表示され、とじるで消える", async ({
    page,
  }) => {
    const todayStr = today();
    const lastExportStr = daysAgo(31);
    const logs = makeLogs(20, todayStr);

    await page.addInitScript(
      (args) => {
        const STORAGE_KEY = "carequest-state-v1";
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 6,
            onboardingShown: true,
            lastExportDate: args.lastExportDate,
            exportReminderLastShown: "",
            logs: args.logs,
          }),
        );
      },
      { lastExportDate: lastExportStr, logs },
    );

    await page.goto(`${BASE}/reflection/`);

    // バックアップリマインドカードが表示される。
    const reminderCard = page.locator("text=たいせつな記録がたまってきました。");
    await expect(reminderCard).toBeVisible({ timeout: 5000 });

    // 「とじる」ボタンをクリックするとカードが消える。
    await page.click("button:has-text('とじる')");
    await expect(reminderCard).not.toBeVisible({ timeout: 3000 });
  });

  test("境界テスト: 記録19件では出ない", async ({ page }) => {
    const todayStr = today();
    const lastExportStr = daysAgo(31);
    const logs = makeLogs(19, todayStr);

    await page.addInitScript(
      (args) => {
        const STORAGE_KEY = "carequest-state-v1";
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 6,
            onboardingShown: true,
            lastExportDate: args.lastExportDate,
            exportReminderLastShown: "",
            logs: args.logs,
          }),
        );
      },
      { lastExportDate: lastExportStr, logs },
    );

    await page.goto(`${BASE}/reflection/`);

    // バックアップリマインドカードが出ないこと。
    const reminderCard = page.locator("text=たいせつな記録がたまってきました。");
    await expect(reminderCard).not.toBeVisible({ timeout: 3000 });
  });
});
