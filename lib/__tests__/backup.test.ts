import { describe, it, expect } from "vitest";
import { mergeRestoredLogs, chunk } from "@/lib/backup";
import { createInitialState, type CareStorageState } from "@/lib/storage";
import type { CareLog } from "@/lib/types";

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
  return { ...createInitialState(), ...overrides };
}

describe("mergeRestoredLogs", () => {
  it("空の端末にサーバーの記録を復元できる(件数を返す)", () => {
    const result = mergeRestoredLogs(makeState(), [makeLog({ id: "a" }), makeLog({ id: "b" })]);
    expect(result.importedLogCount).toBe(2);
    expect(result.state.logs.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("同じ id は重複排除し、既存(ローカル)を必ず残す(サーバーで上書きしない)", () => {
    const existing = makeState({ logs: [makeLog({ id: "shared", title: "ローカル" })] });
    const result = mergeRestoredLogs(existing, [
      makeLog({ id: "shared", title: "サーバー" }),
      makeLog({ id: "new" }),
    ]);
    expect(result.importedLogCount).toBe(1);
    expect(result.state.logs.map((l) => l.id)).toEqual(["shared", "new"]);
    // 既存優先: ローカルの内容がサーバーの内容で巻き戻らない
    expect(result.state.logs.find((l) => l.id === "shared")!.title).toBe("ローカル");
  });

  it("logs 以外(note / user / customTasks)は一切変更しない", () => {
    const existing = makeState({
      note: "内心のメモ",
      customTasks: [{ id: "t1", title: "タスク", points: 10, description: "" }],
      logs: [makeLog({ id: "local" })],
    });
    existing.user.name = "この端末";
    const result = mergeRestoredLogs(existing, [makeLog({ id: "srv" })]);
    expect(result.state.note).toBe("内心のメモ");
    expect(result.state.customTasks).toEqual(existing.customTasks);
    expect(result.state.user.name).toBe("この端末");
  });

  it("サーバーに新しい記録が無ければ 0 件で既存のまま", () => {
    const existing = makeState({ logs: [makeLog({ id: "same" })] });
    const result = mergeRestoredLogs(existing, [makeLog({ id: "same" })]);
    expect(result.importedLogCount).toBe(0);
    expect(result.state.logs.map((l) => l.id)).toEqual(["same"]);
  });

  it("空のサーバー応答でもローカルは壊れない", () => {
    const existing = makeState({ logs: [makeLog({ id: "only" })] });
    const result = mergeRestoredLogs(existing, []);
    expect(result.importedLogCount).toBe(0);
    expect(result.state.logs.map((l) => l.id)).toEqual(["only"]);
  });
});

describe("chunk", () => {
  it("size ごとに分割する(端数は最後のチャンク)", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("空配列は空", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("size が要素数以上なら 1 チャンク", () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("size が 0 以下でも無限ループにならず 1 チャンクに落とす", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
});
