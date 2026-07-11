import { describe, it, expect } from "vitest";
import { getTodaySummaryBody, getEncouragementMessage, getJourneyMessage } from "@/lib/messages";
import type { CareLog } from "@/lib/types";

// テスト用ヘルパー
function makeLog(title: string, overrides: Partial<CareLog> = {}): CareLog {
  return {
    id: `log-${Math.random()}`,
    taskId: "medicine",
    title,
    points: 5,
    completedAt: "2024-03-15T10:00:00",
    date: "2024-03-15",
    energyLevel: "normal",
    ...overrides,
  };
}

describe("getTodaySummaryBody", () => {
  it("0件: 記録なしの労いメッセージを返す", () => {
    const result = getTodaySummaryBody([]);
    expect(result).toBe("今日はまだ記録がありません。それも大切な一日です。");
  });

  it("1件: タイトルを含む単数形メッセージを返す", () => {
    const result = getTodaySummaryBody([makeLog("薬を渡した")]);
    expect(result).toBe("今日は薬を渡したができました。小さく見えても、大切な介護です。");
  });

  it("3件: 3つのタイトルをすべて列挙する(「など」なし)", () => {
    const logs = [
      makeLog("薬を渡した"),
      makeLog("食事を用意した"),
      makeLog("声をかけた"),
    ];
    const result = getTodaySummaryBody(logs);
    expect(result).toContain("薬を渡した");
    expect(result).toContain("食事を用意した");
    expect(result).toContain("声をかけた");
    expect(result).not.toContain("など");
  });

  it("4件以上: 最初の3件のみ表示し「など」を付加する", () => {
    const logs = [
      makeLog("薬を渡した"),
      makeLog("食事を用意した"),
      makeLog("声をかけた"),
      makeLog("リハビリを応援した"),
    ];
    const result = getTodaySummaryBody(logs);
    expect(result).toContain("薬を渡した");
    expect(result).toContain("食事を用意した");
    expect(result).toContain("声をかけた");
    expect(result).not.toContain("リハビリを応援した");
    expect(result).toContain("など");
  });

  it("重複タイトルを除去する", () => {
    // 同じタイトルを3回記録しても1件として扱われる
    const logs = [
      makeLog("薬を渡した"),
      makeLog("薬を渡した"),
      makeLog("薬を渡した"),
    ];
    const result = getTodaySummaryBody(logs);
    // 重複除去で uniqueTitles は1件 → 単数形メッセージ
    expect(result).toBe("今日は薬を渡したができました。小さく見えても、大切な介護です。");
  });

  it("重複除去後に4件以上になる場合のみ「など」を付加する", () => {
    // ユニークが4件: 「など」あり
    const logs = [
      makeLog("薬を渡した"),
      makeLog("食事を用意した"),
      makeLog("声をかけた"),
      makeLog("一緒に笑った"),
      makeLog("薬を渡した"), // 重複
    ];
    const result = getTodaySummaryBody(logs);
    expect(result).toContain("など");
  });

  it("重複除去後に3件以下なら「など」は付かない", () => {
    const logs = [
      makeLog("薬を渡した"),
      makeLog("薬を渡した"),
      makeLog("食事を用意した"),
      makeLog("食事を用意した"),
      makeLog("声をかけた"),
    ];
    const result = getTodaySummaryBody(logs);
    // ユニーク 3件 → 「など」なし
    expect(result).not.toContain("など");
  });

  it("重複除去しても順序が保持される", () => {
    const logs = [
      makeLog("B"),
      makeLog("A"),
      makeLog("C"),
      makeLog("B"), // 重複
    ];
    const result = getTodaySummaryBody(logs);
    // B が A より前に現れることを確認
    expect(result.indexOf("B")).toBeLessThan(result.indexOf("A"));
  });
});

describe("getEncouragementMessage", () => {
  it("low エネルギー分岐: 他の条件に関係なく専用メッセージを返す", () => {
    const result = getEncouragementMessage("low", 100, 10, "薬を渡した");
    expect(result).toBe("今日は5ポイントだけでも十分です。あなたはもう支えています。");
  });

  it("low エネルギー: completedCount=0 でも low 分岐が優先される", () => {
    const result = getEncouragementMessage("low", 0, 0);
    expect(result).toBe("今日は5ポイントだけでも十分です。あなたはもう支えています。");
  });

  it("normal, completedCount=0: 最初の記録を促すメッセージ", () => {
    const result = getEncouragementMessage("normal", 0, 0);
    expect(result).toBe("今日の中で、できたことをひとつだけ残してみましょう。");
  });

  it("normal, ポイント30以上: 一般称賛メッセージ", () => {
    const result = getEncouragementMessage("normal", 30, 3);
    expect(result).toBe("今日も小さな介護が、ちゃんと価値を持っています。");
  });

  it("normal, ポイント29以下, latestTaskTitle あり: タスクタイトルを含むメッセージ", () => {
    const result = getEncouragementMessage("normal", 20, 2, "病院・通院に付き添った");
    expect(result).toContain("病院・通院に付き添った");
  });

  it("normal, ポイント0, completedCount=0 のとき(0件分岐)", () => {
    const result = getEncouragementMessage("normal", 0, 0, undefined);
    expect(result).toBe("今日の中で、できたことをひとつだけ残してみましょう。");
  });

  it("normal, ポイント29以下, latestTaskTitle なし: デフォルトメッセージ", () => {
    const result = getEncouragementMessage("normal", 10, 1);
    expect(result).toBe("今日できたことに、ちゃんと意味があります。");
  });

  it("energetic, ポイント30以上: 称賛メッセージ", () => {
    const result = getEncouragementMessage("energetic", 50, 5);
    expect(result).toBe("今日も小さな介護が、ちゃんと価値を持っています。");
  });
});

// ---------------------------------------------------------------------------
// getJourneyMessage
// ---------------------------------------------------------------------------

describe("getJourneyMessage", () => {
  it("totalLogs=0, recordedDays=0: 記録ゼロの初回ユーザーに穏やかなメッセージ", () => {
    const result = getJourneyMessage(0, 0);
    expect(result).toBeTruthy();
    expect(result).not.toContain("0件");
    expect(result).not.toContain("0日");
  });

  it("totalLogs=1, recordedDays=1: 1件でも記録があれば件数を含む", () => {
    const result = getJourneyMessage(1, 1);
    expect(result).toContain("1件");
  });

  it("recordedDays=7: 7日達成メッセージに日数を含む", () => {
    const result = getJourneyMessage(20, 7);
    expect(result).toContain("7日");
  });

  it("recordedDays=30: 30日達成メッセージに日数を含む", () => {
    const result = getJourneyMessage(100, 30);
    expect(result).toContain("30日");
  });

  it("記録ゼロでも他人との比較・ランキング表現を含まない", () => {
    const result = getJourneyMessage(0, 0);
    expect(result).not.toContain("みんな");
    expect(result).not.toContain("参加者");
    expect(result).not.toContain("介護者");
    expect(result).not.toContain("合計");
  });
});
