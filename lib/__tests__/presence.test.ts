import { describe, it, expect } from "vitest";
import { presenceMessage, PRESENCE_DISPLAY_THRESHOLD } from "@/lib/presence";

const FALLBACK = "今日も、どこかで誰かが介護しています。";

describe("presenceMessage", () => {
  it("null(取得前・失敗)はフォールバック文言", () => {
    expect(presenceMessage(null)).toBe(FALLBACK);
  });

  it("0人はフォールバック文言(寂しい数字を見せない)", () => {
    expect(presenceMessage(0)).toBe(FALLBACK);
  });

  it("閾値未満(4人)はフォールバック文言", () => {
    expect(presenceMessage(PRESENCE_DISPLAY_THRESHOLD - 1)).toBe(FALLBACK);
  });

  it("閾値ちょうど(5人)から人数を出す", () => {
    expect(presenceMessage(PRESENCE_DISPLAY_THRESHOLD)).toBe("今日、5人の介護者が記録しました。");
  });

  it("大きな人数もそのまま出す", () => {
    expect(presenceMessage(128)).toBe("今日、128人の介護者が記録しました。");
  });
});
