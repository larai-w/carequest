import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "components", "FeedbackWidget.tsx"),
  "utf8",
);

describe("FeedbackWidget の公開境界", () => {
  it("匿名フィードバックを公開しないことを完了表示で明示する", () => {
    expect(SOURCE).toContain("内容を公開することはありません");
    expect(SOURCE).not.toContain("そのまま使わせていただきます");
  });
});
