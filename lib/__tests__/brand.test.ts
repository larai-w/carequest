import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// 名前が変わるかもしれないので、画面のコードに名前を直接書かない(2026-10-21)。
// 名前は lib/brand.ts の定数から出す。ここでは app/ と components/ に
// 「Care Quest」「CareQuest」が直接書かれていないことを確かめる。

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HARDCODED_NAME = /Care ?Quest/;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const FILES = [...sourceFiles("app"), ...sourceFiles("components")];

describe("プロダクト名は lib/brand.ts の定数から出す", () => {
  it("見る対象のファイルが見つかっている", () => {
    expect(FILES).toContain(join("app", "about", "page.tsx"));
    expect(FILES).toContain(join("components", "FeedbackWidget.tsx"));
  });

  it.each(FILES)("%s に名前を直接書いていない", (path) => {
    const lines = readFileSync(join(ROOT, path), "utf8").split("\n");
    const hits = lines
      .map((line, i) => (HARDCODED_NAME.test(line) ? `${path}:${i + 1}: ${line.trim()}` : null))
      .filter((hit): hit is string => hit !== null);
    expect(hits, "lib/brand.ts の PRODUCT_NAME / PRODUCT_NAME_COMPACT を使ってください").toEqual([]);
  });
});
