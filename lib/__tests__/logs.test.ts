import { describe, it, expect } from "vitest";
import { removeLog, recalcTodayStats, recentDuplicateCount, restoreLog } from "@/lib/logs";
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

// 2026-09-14 /hci-check 候補 #6: 手の震えなどで、同じケアを続けて2回押してしまう。
// 500ms の連打ガードでは防げないので、確認カードで「少し前にも同じ記録がある」と知らせる。
describe("recentDuplicateCount", () => {
  const base = {
    taskId: "medicine",
    title: "薬を渡した",
    points: 5,
    date: "2026-09-14",
    energyLevel: "normal" as const,
  };
  const at = (id: string, completedAt: string, extra: Partial<typeof base> = {}) => ({ ...base, id, completedAt, ...extra });

  it("5分以内の同じケアの記録を数える(自分自身は数えない)", () => {
    const target = at("b", "2026-09-14T10:04:00.000Z");
    const logs = [at("a", "2026-09-14T10:00:30.000Z"), target];
    expect(recentDuplicateCount(logs, target)).toBe(1);
  });

  it("5分より前の記録は数えない(時間をおいた服薬などは重複ではない)", () => {
    const target = at("b", "2026-09-14T10:06:00.000Z");
    const logs = [at("a", "2026-09-14T10:00:00.000Z"), target];
    expect(recentDuplicateCount(logs, target)).toBe(0);
  });

  it("別のケアは数えない", () => {
    const target = at("b", "2026-09-14T10:01:00.000Z");
    const logs = [at("a", "2026-09-14T10:00:30.000Z", { taskId: "meal" }), target];
    expect(recentDuplicateCount(logs, target)).toBe(0);
  });

  it("時刻が読めない記録は数えない(例外を出さない)", () => {
    const target = at("b", "2026-09-14T10:01:00.000Z");
    const logs = [at("a", "not-a-date"), target];
    expect(recentDuplicateCount(logs, target)).toBe(0);
  });
});
