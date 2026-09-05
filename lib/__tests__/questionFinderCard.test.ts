import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "QuestionFinderCard.tsx"),
  "utf8",
);

describe("QuestionFinderCard の結果フィードバック", () => {
  it("検索結果を読み上げ可能なステータスとして扱う", () => {
    expect(SOURCE).toContain('role="status"');
    expect(SOURCE).toContain('aria-live="polite"');
    expect(SOURCE).toContain('aria-atomic="true"');
  });

  it("候補が答えの確定ではないことを明示する", () => {
    expect(SOURCE).toContain("関連する読みものの候補です");
    expect(SOURCE).toContain("質問への答えを確定するものではありません");
  });
});
