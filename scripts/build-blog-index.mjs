// veai.jp のブログから、質問サジェスト用の索引を作る。
//
// 実行: node scripts/build-blog-index.mjs
// 出力: lib/blogIndex.json
//
// ⚠️ **pubDate をそのまま残し、公開判定は実行時に行う。**
// ここで「今日より前」だけに絞ると、**索引を作り直すまで新しい記事が出ない**。
// pubDate を持たせておけば、予約公開の記事が公開日を迎えた瞬間から候補に入る。
//
// ⚠️ **未来の記事へリンクすると 404 になる。** 2026-08-27 に veai.jp 側で
// 実際にやった（予約公開の記事は build されないので、リンク切れ検査も
// すり抜けた）。ここでは必ず pubDate を持たせ、実行時に弾く。
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BLOG_DIR = join(
  homedir(),
  "Documents/veai_ecosystem/veai-jp-web/src/content/blog",
);
const OUT = join(process.cwd(), "lib", "blogIndex.json");

const field = (head, name) =>
  head.match(new RegExp(`^${name}:\\s*'(.*?)'\\s*$`, "m"))?.[1] ?? "";

const articles = [];
for (const file of readdirSync(BLOG_DIR).filter((f) => /\.mdx?$/.test(f))) {
  const src = readFileSync(join(BLOG_DIR, file), "utf8");
  const fm = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fm) continue;
  const [, head, body] = fm;
  if (!/lang:\s*'ja'/.test(head)) continue; // JA 記事だけ

  const title = field(head, "title");
  const description = field(head, "description");
  const pubDate = field(head, "pubDate");
  if (!title || !pubDate) continue;

  // 見出しは「その記事が何に答えるか」をよく表す。本文全体は入れない
  // (索引が肥大し、関係の薄い語で当たるようになる)。
  const headings = [...body.matchAll(/^#+\s*(.+)$/gm)].map((m) => m[1]);

  articles.push({
    slug: file.replace(/\.mdx?$/, ""),
    title,
    description,
    pubDate,
    headings,
  });
}

articles.sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1));
writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), articles }, null, 1) + "\n");
console.log(`✅ ${articles.length} 記事を索引にした → lib/blogIndex.json`);
const future = articles.filter((a) => a.pubDate > new Date().toISOString().slice(0, 10));
console.log(`   うち予約公開: ${future.length} 本(公開日まで実行時に除外される)`);
