import { describe, it, expect } from "vitest";
import { getTodayStats, getRecentDaySummaries, getJourneyStats } from "@/lib/stats";
import type { CareLog } from "@/lib/types";

// テスト用ヘルパー: 最小構成の CareLog を生成する
function makeLog(overrides: Partial<CareLog> & { date: string; taskId: string }): CareLog {
  return {
    id: `log-${Math.random()}`,
    title: "薬を渡した",
    points: 5,
    completedAt: `${overrides.date}T10:00:00`,
    energyLevel: "normal",
    ...overrides,
  };
}

describe("getTodayStats", () => {
  it("ログが空のとき totalPoints=0、completedTasks=0 を返す", () => {
    const stats = getTodayStats([], "2024-03-15");
    expect(stats.totalPoints).toBe(0);
    expect(stats.completedTasks).toBe(0);
    expect(stats.date).toBe("2024-03-15");
  });

  it("当日のログだけを集計する(他の日は無視)", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-15", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-14", taskId: "meal", points: 5 }), // 前日: 無視
    ];
    const stats = getTodayStats(logs, "2024-03-15");
    expect(stats.completedTasks).toBe(1);
    expect(stats.totalPoints).toBe(5);
  });

  it("ポイントを正しく合計する", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-15", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-15", taskId: "hospital", points: 20 }),
    ];
    const stats = getTodayStats(logs, "2024-03-15");
    expect(stats.totalPoints).toBe(25);
    expect(stats.completedTasks).toBe(2);
  });

  it("taskCounts にカスタムタスク id が来ても壊れない(未知 id は ?? 0 で扱われる)", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-15", taskId: "custom-my-task-xyz", points: 10 }),
    ];
    // 例外が出ずに実行できることを確認
    expect(() => getTodayStats(logs, "2024-03-15")).not.toThrow();
    const stats = getTodayStats(logs, "2024-03-15");
    expect(stats.completedTasks).toBe(1);
    expect(stats.totalPoints).toBe(10);
    // カスタム id はカウントに含まれる
    expect(stats.taskCounts["custom-my-task-xyz"]).toBe(1);
  });

  it("同じタスクを複数回記録するとカウントが加算される", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-15", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-15", taskId: "medicine", points: 5 }),
    ];
    const stats = getTodayStats(logs, "2024-03-15");
    expect(stats.taskCounts["medicine"]).toBe(2);
  });

  it("message フィールドが空でない文字列を含む", () => {
    const stats = getTodayStats([], "2024-03-15");
    expect(typeof stats.message).toBe("string");
    expect(stats.message.length).toBeGreaterThan(0);
  });
});

describe("getRecentDaySummaries", () => {
  it("ログが空のとき空配列を返す(記録なし日はスキップ)", () => {
    const result = getRecentDaySummaries([], 7, "2024-03-15");
    expect(result).toEqual([]);
  });

  it("記録がある日だけ返す(スキップ確認)", () => {
    // 3日前だけに記録がある
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-12", taskId: "medicine", points: 5 }), // 3日前
    ];
    const result = getRecentDaySummaries(logs, 7, "2024-03-15");
    expect(result.length).toBe(1);
    expect(result[0].date).toBe("2024-03-12");
  });

  it("昨日(offset=1)のラベルが「昨日」になる", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-14", taskId: "medicine", points: 5 }),
    ];
    const result = getRecentDaySummaries(logs, 7, "2024-03-15");
    expect(result[0].label).toBe("昨日");
  });

  it("2日前以前は「M月D日」形式のラベルになる", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-13", taskId: "medicine", points: 5 }), // 2日前
    ];
    const result = getRecentDaySummaries(logs, 7, "2024-03-15");
    expect(result[0].label).toBe("3月13日");
  });

  it("最大 days 件(今日は含まない: offset 1〜days)", () => {
    // 過去 3 日すべてに記録
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-14", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-13", taskId: "meal", points: 5 }),
      makeLog({ date: "2024-03-12", taskId: "talk", points: 5 }),
    ];
    const result = getRecentDaySummaries(logs, 3, "2024-03-15");
    expect(result.length).toBe(3);
  });

  it("days=3 のとき 4日前の記録は含まれない", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-11", taskId: "medicine", points: 5 }), // 4日前
    ];
    const result = getRecentDaySummaries(logs, 3, "2024-03-15");
    expect(result.length).toBe(0);
  });

  it("同じ日に複数ログがある場合、ポイントと件数が合算される", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-14", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-14", taskId: "hospital", points: 20 }),
    ];
    const result = getRecentDaySummaries(logs, 7, "2024-03-15");
    expect(result[0].totalPoints).toBe(25);
    expect(result[0].completedTasks).toBe(2);
  });

  it("月初をまたぐ場合(3/1 の 2日前 = 2/28)のラベルが正しい", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-02-28", taskId: "medicine", points: 5 }),
    ];
    const result = getRecentDaySummaries(logs, 7, "2024-03-01");
    expect(result[0].date).toBe("2024-02-28");
    expect(result[0].label).toBe("2月28日");
  });
});

// ---------------------------------------------------------------------------
// getJourneyStats
// ---------------------------------------------------------------------------

describe("getJourneyStats", () => {
  it("ログが空のとき totalPoints=0, totalLogs=0, recordedDays=0, daysSinceFirst=0 を返す", () => {
    const stats = getJourneyStats([]);
    expect(stats.totalPoints).toBe(0);
    expect(stats.totalLogs).toBe(0);
    expect(stats.recordedDays).toBe(0);
    expect(stats.daysSinceFirst).toBe(0);
  });

  it("累計ポイントを全ログから正しく合計する", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-10", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-11", taskId: "meal", points: 10 }),
      makeLog({ date: "2024-03-11", taskId: "hospital", points: 20 }),
    ];
    const stats = getJourneyStats(logs);
    expect(stats.totalPoints).toBe(35);
    expect(stats.totalLogs).toBe(3);
  });

  it("記録した日数(ユニーク日数)を正しく返す", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-10", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-10", taskId: "meal", points: 5 }), // 同日: ユニーク1日
      makeLog({ date: "2024-03-11", taskId: "hospital", points: 20 }),
    ];
    const stats = getJourneyStats(logs);
    expect(stats.recordedDays).toBe(2);
  });

  it("タスク別累計回数を正しく集計する", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-10", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-11", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-11", taskId: "meal", points: 5 }),
    ];
    const stats = getJourneyStats(logs);
    expect(stats.taskCounts["medicine"]).toBe(2);
    expect(stats.taskCounts["meal"]).toBe(1);
  });

  it("daysSinceFirst: 最初の記録日から今日まで1以上の整数を返す", () => {
    // 過去の固定日を使う。今日が 2026-07-11 の場合でも1以上になる。
    const logs: CareLog[] = [
      makeLog({ date: "2024-01-01", taskId: "medicine", points: 5 }),
    ];
    const stats = getJourneyStats(logs);
    expect(stats.daysSinceFirst).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(stats.daysSinceFirst)).toBe(true);
  });

  it("不正な date 文字列が混ざっていても NaN を返さない", () => {
    const logs: CareLog[] = [
      makeLog({ date: "invalid-date", taskId: "medicine", points: 5 }),
      makeLog({ date: "2024-03-10", taskId: "meal", points: 10 }),
    ];
    const stats = getJourneyStats(logs);
    expect(Number.isNaN(stats.totalPoints)).toBe(false);
    expect(Number.isNaN(stats.daysSinceFirst)).toBe(false);
    // 不正な date は validDates から除外されるが、totalLogs には含まれる
    expect(stats.totalLogs).toBe(2);
    expect(stats.recordedDays).toBe(1); // 正常な日付は "2024-03-10" のみ
  });

  it("points が NaN になるログが混ざっていても totalPoints が NaN にならない", () => {
    const logs: CareLog[] = [
      { ...makeLog({ date: "2024-03-10", taskId: "medicine", points: 5 }), points: NaN },
      makeLog({ date: "2024-03-10", taskId: "meal", points: 10 }),
    ];
    const stats = getJourneyStats(logs);
    expect(Number.isNaN(stats.totalPoints)).toBe(false);
    expect(stats.totalPoints).toBe(10);
  });

  it("未来日付の記録が混ざっていても daysSinceFirst が負にならない", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2099-12-31", taskId: "medicine", points: 5 }),
    ];
    const stats = getJourneyStats(logs);
    expect(stats.daysSinceFirst).toBeGreaterThanOrEqual(1);
  });

  it("カスタムタスク id の記録も taskCounts に集計される", () => {
    const logs: CareLog[] = [
      makeLog({ date: "2024-03-10", taskId: "custom-xyz", points: 15 }),
    ];
    const stats = getJourneyStats(logs);
    expect(stats.taskCounts["custom-xyz"]).toBe(1);
  });
});
