/**
 * postbuild: out/sw.js の VERSION 行を git short SHA + 日付で上書きする。
 *
 * - 静的エクスポート後に out/sw.js が生成されている前提で動く
 * - 出力ファイル(out/)だけを変更し、ソース(public/sw.js)は触らない
 * - git が使えない環境(テスト等)では "local-<timestamp>" にフォールバック
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const swPath = join(cwd, "out", "sw.js");

let gitSha;
try {
  gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf8", cwd }).trim();
} catch {
  gitSha = "local";
}

const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const version = `${date}-${gitSha}`;

let content;
try {
  content = readFileSync(swPath, "utf8");
} catch {
  // out/ がない = next build が静的エクスポートではない設定の場合。スキップで無害。
  console.warn("inject-sw-version: out/sw.js が見つかりません。スキップします。");
  process.exit(0);
}

// `const VERSION = "..."` の最初の行だけを置換(コメント内の VERSION は無視)。
const updated = content.replace(/^(const VERSION = )"[^"]*"/m, `$1"${version}"`);

if (updated === content) {
  console.warn("inject-sw-version: VERSION 行が out/sw.js に見つかりませんでした。");
} else {
  writeFileSync(swPath, updated);
  console.log(`Service Worker VERSION を更新しました: ${version}`);
}
