import { describe, it, expect } from "vitest";
import { removeLog, recalcTodayStats, restoreLog } from "@/lib/logs";
import type { CareLog } from "@/lib/types";

// テスト用のログ生成ヘルパー
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

describe("removeLog", () => {
  it("指定した id の記録を除去する", () => {
    const logs = [makeLog({ id: "a" }), makeLog({ id: "b" }), makeLog({ id: "c" })];
    const result = removeLog(logs, "b");
    expect(result.map((l) => l.id)).toEqual(["a", "c"]);
  });

  it("存在しない id は no-op(全件残る)", () => {
    const logs = [makeLog({ id: "a" }), makeLog({ id: "b" })];
    const result = removeLog(logs, "not-exist");
    expect(result.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("空配列を渡しても例外を出さない", () => {
    expect(() => removeLog([], "any-id")).not.toThrow();
    expect(removeLog([], "any-id")).toEqual([]);
  });

  it("元の配列を変更しない(immutable)", () => {
    const logs = [makeLog({ id: "a" }), makeLog({ id: "b" })];
    const original = [...logs];
    removeLog(logs, "a");
    expect(logs).toEqual(original);
  });

  it("同じ id が複数存在する場合はすべて除去する(二重削除の連打で壊れない)", () => {
    const logs = [makeLog({ id: "dup" }), makeLog({ id: "dup" }), makeLog({ id: "other" })];
    const result = removeLog(logs, "dup");
    expect(result.map((l) => l.id)).toEqual(["other"]);
  });

  it("1件だけの配列から削除すると空配列になる", () => {
    const logs = [makeLog({ id: "only" })];
    const result = removeLog(logs, "only");
    expect(result).toEqual([]);
  });
});

describe("recalcTodayStats", () => {
  it("今日の記録のポイント合計と件数を返す", () => {
    const logs = [
      makeLog({ id: "1", date: "2024-03-15", points: 5 }),
      makeLog({ id: "2", date: "2024-03-15", points: 10 }),
      makeLog({ id: "3", date: "2024-03-14", points: 20 }), // 過去日 → 含まない
    ];
    const result = recalcTodayStats(logs, "2024-03-15");
    expect(result.todayPoints).toBe(15);
    expect(result.completedCount).toBe(2);
  });

  it("過去日の記録は今日のポイントに影響しない", () => {
    const logs = [
      makeLog({ id: "1", date: "2024-01-01", points: 999 }),
      makeLog({ id: "2", date: "2024-03-13", points: 999 }),
    ];
    const result = recalcTodayStats(logs, "2024-03-15");
    expect(result.todayPoints).toBe(0);
    expect(result.completedCount).toBe(0);
  });

  it("空配列のとき 0 / 0 を返す", () => {
    const result = recalcTodayStats([], "2024-03-15");
    expect(result.todayPoints).toBe(0);
    expect(result.completedCount).toBe(0);
  });

  it("今日の記録が全部削除された後は 0 / 0 を返す", () => {
    const logs = [makeLog({ id: "old", date: "2024-03-14", points: 10 })];
    const result = recalcTodayStats(logs, "2024-03-15");
    expect(result.todayPoints).toBe(0);
    expect(result.completedCount).toBe(0);
  });
});

describe("restoreLog", () => {
  // 取り消した記録を「元に戻す」ための純関数(2026-09-14 /hci-check 候補 #1)。
  it("取り消した記録を、記録した時刻の順番の位置に戻す", () => {
    const a = makeLog({ id: "a", completedAt: "2024-03-15T08:00:00" });
    const b = makeLog({ id: "b", completedAt: "2024-03-15T09:00:00" });
    const c = makeLog({ id: "c", completedAt: "2024-03-15T10:00:00" });
    const result = restoreLog([a, c], b);
    expect(result.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("すでに同じ id がある場合は二重に足さない(元に戻すの連打で増えない)", () => {
    const a = makeLog({ id: "a" });
    const result = restoreLog([a], a);
    expect(result.map((l) => l.id)).toEqual(["a"]);
  });

  it("空の配列にも戻せる", () => {
    const a = makeLog({ id: "a" });
    expect(restoreLog([], a).map((l) => l.id)).toEqual(["a"]);
  });

  it("元の配列を変更しない(immutable)", () => {
    const a = makeLog({ id: "a", completedAt: "2024-03-15T08:00:00" });
    const b = makeLog({ id: "b", completedAt: "2024-03-15T09:00:00" });
    const logs = [a];
    restoreLog(logs, b);
    expect(logs.map((l) => l.id)).toEqual(["a"]);
  });
});
