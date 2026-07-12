import { describe, it, expect } from "vitest";
import { buildLogsCsv } from "@/lib/export";
import type { CareLog } from "@/lib/types";

function makeLog(overrides: Partial<CareLog> = {}): CareLog {
  return {
    id: "log-1",
    taskId: "medicine",
    title: "薬を渡した",
    points: 5,
    completedAt: new Date(2024, 2, 15, 10, 30).toISOString(),
    date: "2024-03-15",
    energyLevel: "normal",
    ...overrides,
  };
}

describe("buildLogsCsv", () => {
  it("ヘッダー行を先頭に出す", () => {
    const csv = buildLogsCsv([]);
    expect(csv).toBe("日付,時刻,記録,ポイント");
  });

  it("日付・時刻・記録・ポイントを1行に出す", () => {
    const csv = buildLogsCsv([makeLog()]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("日付,時刻,記録,ポイント");
    expect(lines[1]).toBe("2024-03-15,10:30,薬を渡した,5");
  });

  it("completedAt が無ければ時刻は空欄で日付だけ出す", () => {
    const csv = buildLogsCsv([makeLog({ completedAt: "" })]);
    expect(csv.split("\r\n")[1]).toBe("2024-03-15,,薬を渡した,5");
  });

  it("記録にカンマ・引用符・改行があれば正しくエスケープする(RFC 4180)", () => {
    const csv = buildLogsCsv([
      makeLog({ title: '夜中に3回、起きた "大変"\nでも頑張った', completedAt: "" }),
    ]);
    // カンマ/引用符/改行を含むフィールドは "" で囲み、内部の " は "" にする
    expect(csv.split("\r\n")[0]).toBe("日付,時刻,記録,ポイント");
    expect(csv).toContain('"夜中に3回、起きた ""大変""\nでも頑張った"');
  });

  it("日付→時刻の昇順に並べる", () => {
    const csv = buildLogsCsv([
      makeLog({ id: "b", date: "2024-03-16", title: "翌日", completedAt: new Date(2024, 2, 16, 9, 0).toISOString() }),
      makeLog({ id: "a", date: "2024-03-15", title: "前日", completedAt: new Date(2024, 2, 15, 9, 0).toISOString() }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain("前日");
    expect(lines[2]).toContain("翌日");
  });
});
