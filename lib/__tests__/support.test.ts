import { describe, it, expect } from "vitest";
import {
  recordDailyEnergy,
  hasConsecutiveLowEnergy,
  shouldShowSupportNudge,
} from "@/lib/support";
import type { DailyEnergy } from "@/lib/types";

const TODAY = "2026-07-10";

function low(date: string): DailyEnergy {
  return { date, energyLevel: "low" };
}

describe("recordDailyEnergy", () => {
  it("新しい日を追加する", () => {
    const result = recordDailyEnergy([], TODAY, "low");
    expect(result).toEqual([{ date: TODAY, energyLevel: "low" }]);
  });

  it("同じ日は上書きする(重複を作らない)", () => {
    const history = [{ date: TODAY, energyLevel: "normal" as const }];
    const result = recordDailyEnergy(history, TODAY, "low");
    expect(result).toEqual([{ date: TODAY, energyLevel: "low" }]);
  });

  it("元の配列を変更しない", () => {
    const history = [low("2026-07-09")];
    recordDailyEnergy(history, TODAY, "low");
    expect(history).toEqual([low("2026-07-09")]);
  });
});

describe("hasConsecutiveLowEnergy", () => {
  it("履歴が空なら false", () => {
    expect(hasConsecutiveLowEnergy([], TODAY)).toBe(false);
  });

  it("今日まで3日連続 low なら true", () => {
    const history = [low("2026-07-08"), low("2026-07-09"), low("2026-07-10")];
    expect(hasConsecutiveLowEnergy(history, TODAY)).toBe(true);
  });

  it("昨日まで3日連続 low なら(今日未記録でも)true", () => {
    // 直近の記録が昨日で、そこから3日連続 low
    const history = [low("2026-07-07"), low("2026-07-08"), low("2026-07-09")];
    expect(hasConsecutiveLowEnergy(history, TODAY)).toBe(true);
  });

  it("2日だけの連続では false", () => {
    const history = [low("2026-07-09"), low("2026-07-10")];
    expect(hasConsecutiveLowEnergy(history, TODAY)).toBe(false);
  });

  it("途中に記録の無い日(ギャップ)があれば連続とみなさない", () => {
    // 7-10 low, 7-09 なし, 7-08 low, 7-07 low → today からの連続は 1 で止まる
    const history = [low("2026-07-10"), low("2026-07-08"), low("2026-07-07")];
    expect(hasConsecutiveLowEnergy(history, TODAY)).toBe(false);
  });

  it("途中に low 以外があれば連続が途切れる", () => {
    const history = [
      low("2026-07-10"),
      { date: "2026-07-09", energyLevel: "normal" as const },
      low("2026-07-08"),
      low("2026-07-07"),
    ];
    expect(hasConsecutiveLowEnergy(history, TODAY)).toBe(false);
  });

  it("最新の記録が古い(一昨日以前)ときは stale として false", () => {
    // 3日連続 low だが、最新が一昨日(7-08)なので出さない
    const history = [low("2026-07-06"), low("2026-07-07"), low("2026-07-08")];
    expect(hasConsecutiveLowEnergy(history, TODAY)).toBe(false);
  });

  it("未来の日付は無視して today 以前で判定する", () => {
    const history = [
      low("2026-07-11"), // 未来 → 無視
      low("2026-07-08"),
      low("2026-07-09"),
      low("2026-07-10"),
    ];
    expect(hasConsecutiveLowEnergy(history, TODAY)).toBe(true);
  });
});

describe("shouldShowSupportNudge", () => {
  const lowStreak = [low("2026-07-08"), low("2026-07-09"), low("2026-07-10")];

  it("連続 low を満たさなければ false", () => {
    const input = { energyHistory: [low(TODAY)], supportNudgeLastShown: "" };
    expect(shouldShowSupportNudge(input, TODAY)).toBe(false);
  });

  it("連続 low を満たし未表示なら true", () => {
    const input = { energyHistory: lowStreak, supportNudgeLastShown: "" };
    expect(shouldShowSupportNudge(input, TODAY)).toBe(true);
  });

  it("最近(数日以内)に表示済みなら throttle で false", () => {
    const input = { energyHistory: lowStreak, supportNudgeLastShown: "2026-07-09" };
    expect(shouldShowSupportNudge(input, TODAY)).toBe(false);
  });

  it("十分に日があいていれば再表示する", () => {
    // minGapDays=3。7-10 の3日前 = 7-07。7-07 は「より新しい」ではないので通す。
    const input = { energyHistory: lowStreak, supportNudgeLastShown: "2026-07-07" };
    expect(shouldShowSupportNudge(input, TODAY)).toBe(true);
  });
});
