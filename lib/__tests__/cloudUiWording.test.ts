import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// クラウド控えまわりの画面文言(2026-09-14 /hci-check「クラウド控え」#5・#7・#8・#9)。

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

// コメント行を除いた、画面に出うる部分だけを見る。
function visibleSource(path: string): string {
  return read(path)
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*"));
    })
    .join("\n");
}

const USER_FACING = [
  "components/AuthPanel.tsx",
  "components/CloudBackupCard.tsx",
  "components/OnboardingCard.tsx",
  "app/reflection/page.tsx",
  "app/about/page.tsx",
  "app/privacy/page.tsx",
  "lib/cloudMessages.ts",
];

describe("用語を「ログイン／ログアウト」にそろえる(#8)", () => {
  it.each(USER_FACING)("%s に「サインイン」「サインアウト」が出ない", (path) => {
    const source = visibleSource(path);
    expect(source).not.toContain("サインイン");
    expect(source).not.toContain("サインアウト");
  });
});

describe("AuthPanel", () => {
  const source = visibleSource("components/AuthPanel.tsx");

  it("何が起きるか分からない「状態確認」を使わない(#7)", () => {
    expect(source).not.toContain("状態確認");
    expect(source).toContain("クラウドと同期する");
  });

  it("「記録はクラウドにも控えられています」と決めつけない(#3)", () => {
    expect(source).not.toContain("記録はクラウドにも控えられています");
    expect(source).toContain("lastBackupLine");
  });

  it("サインイン直後の知らせは結果に合わせて出す(#2)", () => {
    expect(source).toContain("signInSyncMessage");
  });

  it("ログアウト後、端末に記録が残っていることと消し方を言う(#9)", () => {
    expect(source).toContain("この端末の記録は、この端末に残っています");
    expect(source).toContain("すべての記録を削除する");
  });

  it("別のアカウントの記録がある端末で、本人が選べる(#1)", () => {
    expect(source).toContain("この端末の記録は、このアカウントのものです");
  });
});

describe("CloudBackupCard", () => {
  const source = visibleSource("components/CloudBackupCard.tsx");

  it("控えるものと控えないものを書く(#5)", () => {
    expect(source).toContain("ケアの記録");
    expect(source).toContain("メモ");
    expect(source).toContain("控えません");
    expect(source).toContain("自分の記録を保存する（JSON）");
  });

  it("最後に控えた日時を出す(#3)", () => {
    expect(source).toContain("lastBackupLine");
  });
});
