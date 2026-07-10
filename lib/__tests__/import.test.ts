import { describe, it, expect } from "vitest";
import { parseAndMergeImport } from "@/lib/import";
import { createInitialUser, type CareStorageState } from "@/lib/storage";
import type { CareLog, CareTask } from "@/lib/types";

function makeLog(overrides: Partial<CareLog> = {}): CareLog {
  return {
    id: "log-1",
    taskId: "medicine",
    title: "薬を渡した",
    points: 5,
    completedAt: "2024-03-15T10:00:00",
    date: "2024-03-15",
    energyLevel: "normal",
    ...overrides,
  };
}

function makeState(overrides: Partial<CareStorageState> = {}): CareStorageState {
  return {
    user: createInitialUser(),
    logs: [],
    note: "",
    customTasks: [],
    energyHistory: [],
    supportNudgeLastShown: "",
    ...overrides,
  };
}

// buildExportPayload と同じ形の JSON 文字列を作るヘルパー。
function makeExportFile(data: Partial<CareStorageState>): string {
  return JSON.stringify({
    exportedAt: "2024-03-15T12:00:00.000Z",
    app: { name: "Care Quest", version: "0.1.0" },
    data: {
      user: createInitialUser(),
      logs: [],
      note: "",
      customTasks: [],
      ...data,
    },
  });
}

describe("parseAndMergeImport", () => {
  it("壊れた JSON は取り込まず、穏やかなメッセージを返す", () => {
    const result = parseAndMergeImport("{ not json !!!", makeState());
    expect(result.ok).toBe(false);
    expect(result.state).toBeUndefined();
    expect(result.message).toContain("読み込めませんでした");
  });

  it("他アプリの JSON(app.name が違う)は拒否する", () => {
    const foreign = JSON.stringify({
      app: { name: "Some Other App" },
      data: { logs: [makeLog()] },
    });
    const result = parseAndMergeImport(foreign, makeState());
    expect(result.ok).toBe(false);
    expect(result.state).toBeUndefined();
    expect(result.message).toContain("Care Quest の記録ではない");
  });

  it("app フィールドがない JSON も拒否する", () => {
    const noApp = JSON.stringify({ data: { logs: [makeLog()] } });
    const result = parseAndMergeImport(noApp, makeState());
    expect(result.ok).toBe(false);
  });

  it("data がオブジェクトでない場合も拒否する", () => {
    const badData = JSON.stringify({ app: { name: "Care Quest" }, data: "壊れた" });
    const result = parseAndMergeImport(badData, makeState());
    expect(result.ok).toBe(false);
  });

  it("空の端末に記録を復元できる(件数を返す)", () => {
    const file = makeExportFile({ logs: [makeLog({ id: "a" }), makeLog({ id: "b" })] });
    const result = parseAndMergeImport(file, makeState());
    expect(result.ok).toBe(true);
    expect(result.importedLogCount).toBe(2);
    expect(result.state!.logs.map((l) => l.id)).toEqual(["a", "b"]);
    expect(result.message).toContain("2件");
  });

  it("既存記録と同じ id は重複排除し、既存を必ず残す", () => {
    const existing = makeState({ logs: [makeLog({ id: "shared", title: "既存" })] });
    const file = makeExportFile({
      logs: [makeLog({ id: "shared", title: "インポート" }), makeLog({ id: "new" })],
    });
    const result = parseAndMergeImport(file, existing);

    expect(result.ok).toBe(true);
    // 新しく足されたのは "new" の 1 件だけ
    expect(result.importedLogCount).toBe(1);
    expect(result.state!.logs.map((l) => l.id)).toEqual(["shared", "new"]);
    // 既存の内容が保持される(インポート側で上書きされない)
    expect(result.state!.logs.find((l) => l.id === "shared")!.title).toBe("既存");
  });

  it("customTasks も id で重複排除して統合する", () => {
    const existingTask: CareTask = { id: "custom-1", title: "既存タスク", points: 10, description: "" };
    const existing = makeState({ customTasks: [existingTask] });
    const file = makeExportFile({
      customTasks: [
        { id: "custom-1", title: "重複", points: 10, description: "" },
        { id: "custom-2", title: "新タスク", points: 15, description: "" },
      ],
    });
    const result = parseAndMergeImport(file, existing);

    expect(result.state!.customTasks.map((t) => t.id)).toEqual(["custom-1", "custom-2"]);
    expect(result.state!.customTasks.find((t) => t.id === "custom-1")!.title).toBe("既存タスク");
  });

  it("note は既存が空のときだけ取り込む", () => {
    const file = makeExportFile({ note: "インポートしたメモ" });

    const emptyExisting = parseAndMergeImport(file, makeState({ note: "" }));
    expect(emptyExisting.state!.note).toBe("インポートしたメモ");

    const filledExisting = parseAndMergeImport(file, makeState({ note: "今書いてある内心" }));
    // 既存のメモは上書きされない
    expect(filledExisting.state!.note).toBe("今書いてある内心");
  });

  it("user.goodThings は和集合になり、他の user 設定は既存を維持する", () => {
    const existing = makeState({
      user: { ...createInitialUser(), name: "この端末", goodThings: ["散歩した"] },
    });
    const file = makeExportFile({
      user: { ...createInitialUser(), name: "別端末", goodThings: ["散歩した", "読書した"] },
    });
    const result = parseAndMergeImport(file, existing);

    expect(result.state!.user.goodThings).toEqual(["散歩した", "読書した"]);
    // 端末のプロフィール(名前)は乗っ取られない
    expect(result.state!.user.name).toBe("この端末");
  });

  it("Care Quest の形でも中身が壊れていれば sanitize で除外される(生 JSON を信用しない)", () => {
    const file = JSON.stringify({
      app: { name: "Care Quest", version: "0.1.0" },
      data: {
        user: createInitialUser(),
        logs: [
          makeLog({ id: "ok" }),
          { id: "bad", taskId: "x", title: "不正", points: "5", date: "2024-03-15", completedAt: "", energyLevel: "normal" },
          { id: "bad-date", taskId: "x", title: "不正日付", points: 5, date: "2024/03/15", completedAt: "", energyLevel: "normal" },
        ],
        note: "",
        customTasks: [],
      },
    });
    const result = parseAndMergeImport(file, makeState());

    expect(result.ok).toBe(true);
    // points が文字列・date 形式不正の要素は sanitize で除外され、健全な "ok" のみ残る
    expect(result.state!.logs.map((l) => l.id)).toEqual(["ok"]);
    expect(result.importedLogCount).toBe(1);
  });

  it("新しく増える記録が無いときは 0 件であることを穏やかに伝える", () => {
    const existing = makeState({ logs: [makeLog({ id: "same" })] });
    const file = makeExportFile({ logs: [makeLog({ id: "same" })] });
    const result = parseAndMergeImport(file, existing);

    expect(result.ok).toBe(true);
    expect(result.importedLogCount).toBe(0);
    expect(result.message).toContain("新しく増えた記録はありません");
  });
});
