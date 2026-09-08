import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import type { CareStorageState } from "../lib/storage";

test.use({ serviceWorkers: "block" });
const KEY = "carequest-state-v1";
const reflection = "/carequest/reflection/";
function fixture(): CareStorageState & { version: number } {
  return {
    version: 6,
    user: { id: "test-user", name: "テストプロフィール", energyLevel: "low", todayPoints: 5,
      lastActiveDate: "2024-03-15", reflectionNote: "プロフィール用メモ", restMode: true, goodThings: ["昔のよかったこと"] },
    logs: [{ id: "test-history", taskId: "test-task", title: "テスト記録", points: 5,
      completedAt: "2024-03-15T10:00:00.000Z", date: "2024-03-15", energyLevel: "low" }],
    note: "テスト用のひとこと",
    customTasks: [{ id: "test-task", title: "テストの準備", points: 5, description: "確認用" }],
    energyHistory: [{ date: "2024-03-15", energyLevel: "low" }],
    goodThingsHistory: [{ date: "2024-03-15", items: ["自分の休憩ができた"] }],
    supportNudgeLastShown: "2024-03-15", onboardingShown: true,
    lastExportDate: "2024-03-15", exportReminderLastShown: "2024-03-15",
  };
}
async function localOnly(context: BrowserContext, baseURL: string) {
  const origin = new URL(baseURL).origin;
  if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Use a local test server");
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
}
async function seed(page: Page, data: ReturnType<typeof fixture>) {
  // Seed before hydration, once per tab; subsequent reloads must use the real saved result.
  await page.addInitScript(({ key, data }) => {
    if (sessionStorage.getItem("carequest-e2e-seeded")) return;
    localStorage.setItem(key, JSON.stringify(data));
    sessionStorage.setItem("carequest-e2e-seeded", "1");
  }, { key: KEY, data });
  await page.goto(reflection);
  await expect(page.locator("#reflection-note")).toHaveValue(data.note);
}
async function stored(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), KEY);
}
const file = (data: CareStorageState) => ({ name: "test-backup.json", mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify({ app: { name: "Care Quest", version: "0.1.0" }, data })) });

test("JSON export restores records and notes in a fresh browser, retaining destination settings", async ({ page, browser, baseURL }, testInfo) => {
  await localOnly(page.context(), baseURL!);
  await seed(page, fixture());
  // Exercise the actual note editor, then the actual download button.
  await page.locator("#reflection-note").fill("画面で入力したテストメモ");
  await expect.poll(async () => (await stored(page)).note).toBe("画面で入力したテストメモ");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "自分の記録を保存する（JSON）", exact: true }).click();
  const backupPath = testInfo.outputPath("backup.json");
  await (await downloading).saveAs(backupPath);
  const source = await stored(page);
  const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    await localOnly(context, baseURL!);
    const target = await context.newPage();
    await target.goto(reflection);
    await target.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(target.getByText("1件の記録を読み込みました。", { exact: true })).toBeVisible();
    await target.reload();
    await expect(target.locator("#reflection-note")).toHaveValue(source.note);
    const restored = await stored(target);
    for (const field of ["logs", "note", "customTasks", "energyHistory", "goodThingsHistory"])
      expect(restored[field]).toEqual(source[field]);
    expect(restored.user.goodThings).toEqual(source.user.goodThings);
    expect(restored.user.name).toBe("あなた");
    expect(restored.user.restMode).toBe(false);
    expect(restored.supportNudgeLastShown).toBe("");
    expect(restored.lastExportDate).toBe("");
    const before = await stored(target);
    await target.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(target.getByText("読み込みは完了しました。新しく増えた記録はありませんでした。", { exact: true })).toBeVisible();
    expect(await stored(target)).toEqual(before);
  } finally { await context.close(); }
});

test("import preserves existing records and notes and rejects an invalid file", async ({ page, baseURL }) => {
  await localOnly(page.context(), baseURL!);
  const existing = fixture(); await seed(page, existing);
  const incoming = fixture(); incoming.logs[0].title = "上書きしない記録";
  incoming.logs.push({ ...incoming.logs[0], id: "new-log" }); incoming.note = "上書きしないメモ";
  await page.locator('input[type="file"]').setInputFiles(file(incoming));
  await expect(page.getByText("1件の記録を読み込みました。", { exact: true })).toBeVisible();
  const merged = await stored(page);
  expect(merged.logs).toEqual([...existing.logs, incoming.logs[1]]);
  expect(merged.note).toBe(existing.note);
  await page.locator('input[type="file"]').setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{broken") });
  await expect(page.getByText(/ファイルを読み込めませんでした。Care Quest/)).toBeVisible();
  expect(await stored(page)).toEqual(merged);
});

test("failed persistence never reports successful import and permits retry", async ({ page, baseURL }) => {
  await localOnly(page.context(), baseURL!); await seed(page, fixture());
  const before = await stored(page);
  const incoming = fixture(); incoming.logs[0].id = "new-log";
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "carequest-state-v1") throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.locator('input[type="file"]').setInputFiles(file(incoming));
  await expect(page.getByText(/保存できませんでした/)).toBeVisible();
  await expect(page.getByText("1件の記録を読み込みました。", { exact: true })).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  await page.reload();
  await page.locator('input[type="file"]').setInputFiles(file(incoming));
  await expect(page.getByText("1件の記録を読み込みました。", { exact: true })).toBeVisible();
  expect((await stored(page)).logs).toHaveLength(2);
});
