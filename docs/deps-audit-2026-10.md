# 依存パッケージとセキュリティのお知らせの確認 (2026-10-17)

調べたもの: `npm audit`(ルート・`infra/`)、`npm outdated`、開いている PR(Dependabot を含む)。

- 開いている Dependabot の PR: **無し**(minor / patch は #154・#155 でマージ済み)。
- Dependabot のお知らせ(alerts)の画面は、この作業の環境からは読めなかった。`npm audit` は同じ
  GitHub Advisory Database を見ているので、npm の分は下の表で代わりになる。GitHub の画面でも一度見ておくこと。
- `npm audit --omit=dev`(CI の門): ルート・`infra/` とも **0 件**。

## 分け方

### 直す(小さく安全)— この PR で更新した

既知の脆弱性ではなく、同じメジャーの中のパッチ更新。Dependabot が次の月曜に出すものを先に当てた。

| パッケージ | 場所 | 前 → 後 |
| --- | --- | --- |
| next / eslint-config-next | ルート | 16.4.0 → 16.4.2 |
| react / react-dom(固定版のまま) | ルート | 19.3.0 → 19.3.1 |
| aws-amplify | ルート | 6.22.1 → 6.22.2 |
| @playwright/test | ルート(dev) | 1.64.0 → 1.64.1 |
| vitest | ルート・infra(dev) | 4.1.11 → 4.1.12 |
| @aws-sdk/client-dynamodb | infra(dev・テスト用) | 3.1149.0 → 3.1152.0 |

next 16.4.2 は `next dev` のときに `AGENTS.md` の見出しを1段下げて書き直すため、その差分も入れた。

### 直す(大きい・判断が要る)— 直していない

どれもセキュリティの修正ではない。メジャー更新で、Dependabot の設定でも自動 PR を止めている。

| パッケージ | 今 → 最新 | 判断が要る理由 |
| --- | --- | --- |
| eslint | 9.39.5 → 10.x | eslint-config-next 16 が eslint 10 に対応しているか、設定の書き方が変わるかを先に確かめる |
| typescript | 5.9.3 → 7.x(ルート・infra) | 型チェックとビルドの挙動が変わる。next・CDK の対応を見てから |
| vitest | 4.1.12 → 5.x(ルート・infra) | テスト基盤のメジャー。`aws-sdk-client-mock-vitest` と揃えて上げる必要がある |
| aws-sdk-client-mock-vitest | 7.1.0 → 8.x(infra) | vitest 5 と組で上げる |
| @types/node | 20.x → 26.x(ルート・infra) | 最新に合わせるのではなく、実際に動く Node(CI と Lambda は 24)に合わせて `^24` にするのがよい |

### 影響なし

| お知らせ | 重さ | 理由 |
| --- | --- | --- |
| braces `<=3.0.3` — 深く入れ子の pattern でスタックを使い切る(DoS)[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | high | 経路は `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` で、lint のときだけ使う dev 専用。配信物に入らない(`--omit=dev` で 0 件)。pattern は自分たちの設定から来るもので、外からの入力を渡していない。修正版はまだ出ていない(最新が 3.0.3)。`npm audit fix` が出す案は eslint-config-next を 14 に下げるもので、取らない。修正版が出たら Dependabot か `overrides` で上げる |

## 確かめたこと(この PR の状態で)

- ルート: `npm ci`、`check_public_repo.py --tracked`、`npm audit --audit-level=high --omit=dev`、`npm run lint`、
  `npm test`、`npx tsc --noEmit`、`npm run build`、Playwright の E2E(29 件)
- infra: `npm ci`、`npm run build`、`npm test`、`npm run synth`(AWS には触れていない)、`npm audit`

メモ: 手元の npm 10.9 では `npm install` が vitest の peer の解決で落ちた(npm 側の不具合)。CI と同じ npm 11 で
lockfile を作り直した。
