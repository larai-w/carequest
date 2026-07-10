/**
 * Care Quest 機能追加テスト(第5バッチ機能: T32)
 *
 * 対象フロー:
 *   1. オンボーディング: 初回訪問でカード表示 → 「はじめる」→ リロードで再表示されない
 *   2. インポート: 正常 JSON → 件数メッセージ + 記録増加 / 壊れた JSON → エラーメッセージ
 *   3. 相談窓口カード: 3日連続 low 注入 → カード表示 → 「とじる」で消える
 *
 * basePath: /carequest  (next.config.ts の basePath 設定に準拠)
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

const BASE = "/carequest";

// ---------------------------------------------------------------------------
// ヘルパー: YYYY-MM-DD 形式の日付文字列を返す(ローカル日付基準)
// (相談窓口テストのブラウザ内注入コードは addInitScript の中で自前定義する。
//  addInitScript はブラウザで実行されるため、Node 側の関数は参照できない)
// ---------------------------------------------------------------------------
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// テスト 1: オンボーディング
// ---------------------------------------------------------------------------

test.describe("オンボーディング", () => {
  // このテストグループでは beforeEach を設けない。
  // 各テストの addInitScript で localStorage を明示的に制御する。

  test("初回訪問でカードが表示され、はじめるをクリックすると消え、リロード後も再表示されない", async ({
    browser,
  }) => {
    // addInitScript は同一 page に追加されたスクリプトを全ナビゲーションで実行するため、
    // リロード後の検証に同一 page を使うと「再訪問でも onboardingShown: false 注入」が
    // 再実行されてしまう。
    // 解決策: 1) 初回訪問用の page (onboardingShown: false 注入あり)
    //          2) リロード検証用の page (注入なし = 実際の localStorage をそのまま読む)
    // という2つのページを同一ブラウザコンテキスト(同一 localStorage)で使う。

    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    try {
      // --- ページ1: 初回訪問のシミュレーション ---
      const page1 = await context.newPage();
      await page1.addInitScript(() => {
        const STORAGE_KEY = "carequest-state-v1";
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 4,
            onboardingShown: false,
            supportNudgeLastShown: "",
            energyHistory: [],
          }),
        );
      });

      await page1.goto(`${BASE}/`);

      // オンボーディングカードが表示されている。
      const card1 = page1.locator('[aria-label="はじめてのかたへ"]');
      await expect(card1).toBeVisible();

      // 「はじめる」ボタンをクリックする。
      await page1.click("button:has-text('はじめる')");

      // カードが消える。
      await expect(card1).not.toBeVisible();

      await page1.close();

      // --- ページ2: 再訪問のシミュレーション(注入なし = 実際の localStorage を読む) ---
      // addInitScript なし。「はじめる」後の localStorage を引き継ぐ。
      const page2 = await context.newPage();
      await page2.goto(`${BASE}/`);

      // リロードしてもカードが再表示されない。
      const card2 = page2.locator('[aria-label="はじめてのかたへ"]');
      await expect(card2).not.toBeVisible();

      await page2.close();
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// テスト 2: インポート
// ---------------------------------------------------------------------------

test.describe("インポート", () => {
  // このグループでも onboardingShown: true を注入して UI をクリアにする。
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const STORAGE_KEY = "carequest-state-v1";
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const state: Record<string, unknown> = raw
        ? (JSON.parse(raw) as Record<string, unknown>)
        : {};
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, onboardingShown: true, version: 4 }),
      );
    });
  });

  test("正常な JSON を読み込むと件数メッセージと記録の増加が確認できる", async ({
    page,
  }) => {
    // 今日の日付を使ってテストデータを作る。
    const today = formatDate(new Date());

    // Care Quest エクスポート形式の JSON を一時ファイルに書く。
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      app: { name: "Care Quest", version: "0.1.0" },
      data: {
        user: {
          id: "caregiver-1",
          name: "あなた",
          energyLevel: "normal",
          todayPoints: 10,
          lastActiveDate: today,
          reflectionNote: "",
          restMode: false,
          goodThings: [],
        },
        logs: [
          {
            id: "import-test-log-001",
            taskId: "task-1",
            title: "インポートテスト記録",
            points: 10,
            completedAt: new Date().toISOString(),
            date: today,
            energyLevel: "normal",
          },
        ],
        note: "",
        customTasks: [],
        energyHistory: [],
        supportNudgeLastShown: "",
        onboardingShown: true,
      },
    };

    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, "carequest-import-test.json");
    fs.writeFileSync(tmpFile, JSON.stringify(exportPayload, null, 2), "utf-8");

    try {
      await page.goto(`${BASE}/reflection/`);

      // 現在の記録数を確認する(読み込み前)。
      const logsBefore = page.locator("text=インポートテスト記録");
      await expect(logsBefore).not.toBeVisible();

      // 「記録を読み込む」ボタンをクリックして hidden input にファイルをセットする。
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.click("button:has-text('記録を読み込む')"),
      ]);
      await fileChooser.setFiles(tmpFile);

      // 「1件の記録を読み込みました」メッセージが表示される。
      await expect(page.locator("text=1件の記録を読み込みました")).toBeVisible({ timeout: 5000 });

      // 記録が画面に増えている(同日なので「今日やったこと」セクションに表示される)。
      // 複数の要素にマッチしないよう、記録カード内のテキストを first() で絞り込む。
      await expect(page.locator("text=インポートテスト記録").first()).toBeVisible();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test("壊れた JSON を読み込むと穏やかなエラーメッセージが表示される", async ({ page }) => {
    // 壊れた JSON ファイルを一時ファイルに書く。
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, "carequest-broken-import-test.json");
    fs.writeFileSync(tmpFile, "{ this is not valid JSON }", "utf-8");

    try {
      await page.goto(`${BASE}/reflection/`);

      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.click("button:has-text('記録を読み込む')"),
      ]);
      await fileChooser.setFiles(tmpFile);

      // 「読み込めませんでした」を含む穏やかなエラーメッセージが表示される。
      await expect(page.locator("text=/読み込めませんでした/")).toBeVisible({ timeout: 5000 });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

// ---------------------------------------------------------------------------
// テスト 3: 相談窓口カード
// ---------------------------------------------------------------------------

test.describe("相談窓口カード", () => {
  test.beforeEach(async ({ page }) => {
    // 今日を含む3日連続 low の energyHistory を注入する。
    // 日付は実行日から動的に生成する(固定日付だと stale ガードで落ちる)。
    await page.addInitScript(() => {
      const STORAGE_KEY = "carequest-state-v1";

      // ローカル日付基準で YYYY-MM-DD を返すヘルパー(ブラウザ内で実行)。
      function formatLocalDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }

      function daysAgoLocal(n: number): string {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return formatLocalDate(d);
      }

      // 今日・1日前・2日前を low にする(3日連続)。
      const energyHistory = [
        { date: daysAgoLocal(2), energyLevel: "low" },
        { date: daysAgoLocal(1), energyLevel: "low" },
        { date: daysAgoLocal(0), energyLevel: "low" },
      ];

      const state = {
        version: 4,
        onboardingShown: true,
        supportNudgeLastShown: "",
        energyHistory,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    });
  });

  test("3日連続 low で相談窓口カードが表示され、とじるで消える", async ({ page }) => {
    await page.goto(`${BASE}/`);

    // 相談窓口カードが表示される。
    // SupportNudgeCard には「ここ数日、おつかれが」という文言がある。
    const nudgeCard = page.locator("text=ここ数日、おつかれがたまっていませんか");
    await expect(nudgeCard).toBeVisible({ timeout: 5000 });

    // 「とじる」ボタンをクリックするとカードが消える。
    await page.click("button:has-text('とじる')");
    await expect(nudgeCard).not.toBeVisible();
  });
});
