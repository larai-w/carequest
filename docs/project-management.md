# Care Quest project management

Last updated: 2026-07-10 JST

This document defines how to manage Care Quest with GitHub Issues and GitHub Projects.

## ITIL / PMP の観点(2026-07-10 導入・以後の全バッチに適用)

オーナー方針により、タスク立案・実行・リリースには ITIL 4 と PMP の観点を明示的に取り込む。プランナー(Fable)はバッチ立案時に次のレンズで点検する。

### ITIL(サービスマネジメント)

| プラクティス | Care Quest での適用 |
| --- | --- |
| 価値の共創(Focus on value) | 価値 =「介護者が今日を認められること」。頑張り量の最大化ではない(docs/design-principles.md) |
| 変更有効化(Change enablement) | 標準変更(文言・タスクデータ)= プランナー承認で完結 / 通常変更(機能・インフラ)= 人間承認 / 緊急変更 = 手順書に従う。詳細は T15 で `docs/release-checklist.md` に文書化 |
| リリース管理 | development→main のチェックリスト運用。SW の `VERSION` は `npm run build` postbuild で自動注入(手動変更不要) |
| インシデント・問題管理 | CloudWatch アラーム + `docs/runbook.md`(T14)。検知 → runbook → 恒久対策を Issue 化 |
| 継続的改善 | 各バッチの「実行結果メモ」= 教訓ログ。得た知見は `.claude/skills/` に還元して再発を仕組みで防ぐ |
| ナレッジ管理 | docs/ と `.claude/skills/` が SSOT。口頭・チャット限りの決定を作らない |

### PMP(プロジェクトマネジメント)

| 知識エリア | Care Quest での適用 |
| --- | --- |
| スコープ | 内部戦略ノート(非公開・エピック→ストーリー)→ task-list.md(バッチ)→ Issue。バッチは5件まで、スコープクリープはワーカーの「提案」欄で受けて次バッチで判断 |
| リスク | `docs/risk-register.md`(T16)。バッチ立案時に登録簿を見直し、新リスクを追記 |
| 品質 | DoD: lint/build green + トーンガイド準拠 + docs 更新 + 人間作業の human-todo 記録。受け入れ条件のないタスクは着手しない |
| 資源・調達 | プランナー(Fable)/ ワーカー(Sonnet=定型、Opus=難所)/ 人間(承認・秘匿情報・実機)。モデル選択基準は carequest-delegate スキル |
| ステークホルダー | 一次: 家族介護者(ペルソナ)。二次: ケアマネ・支援団体(Phase 3)。人間オーナー = スポンサー(承認権限者) |
| コミュニケーション | 人間への引き継ぎは human-todo.md に一元化。コミットは1タスク1コミット |
| スケジュール | フェーズの Exit 条件(内部戦略ノート・非公開)で判断。日付ノルマは作らない(プロダクト原則と整合) |

### バッチ立案時のチェックリスト(プランナー用)

1. 価値: このバッチはユーザーの「今日を認める」体験か、それを支える運用品質に寄与するか
2. リスク: risk-register に照らして、新しいリスクを生む/軽減するタスクはどれか
3. 変更タイプ: 各タスクは標準変更か通常変更か。人間承認ポイントを human-todo に書いたか
4. 品質: 全タスクに受け入れ条件と DoD があるか
5. 教訓: 前バッチの実行結果メモから、今回の進め方を変える点はあるか
6. 入力確認: open の GitHub Issue(synthetic-check 起票含む)・直近の CI 失敗・`docs/improvement-log.md` を立案の入力として確認したか

## Definition of Done (DoD)

PMP「品質」知識エリアの適用として、**全タスクに共通の完了基準**を定義します。タスクが DoD を満たさない限り「Done」にしません。受け入れ条件のないタスクは着手しません。

### 全タスク共通

| 項目 | 確認内容 |
| --- | --- |
| 受け入れ条件 | タスクに定義された受け入れ条件を全て満たしている |
| lint・build green | コードを変更するタスクは `npm run lint` と `npm run build` が成功している |
| トーンガイド準拠 | ユーザー向け文言を変更するタスクは `docs/design-principles.md` のプレッシャー源チェックリストに抵触しない |
| 関連 docs 更新 | 仕様・設計・運用に影響する変更は `docs/` の該当ドキュメントを同一コミットまたはタスク内で更新している |
| human-todo 記録 | 人間作業(承認・実機確認・秘匿情報の設定など)が発生する場合は `docs/human-todo.md` に記載している |
| 1タスク1コミット | 標準変更はプランナー承認で完結。通常変更・緊急変更は `docs/release-checklist.md` の承認マトリクスに従う |
| 再発防止とセット | レビューや本番で見つかった欠陥の修正は、再発防止(回帰テスト or スキル/テンプレ追記)とセットで Done とする(先行事例: T28 の pk 上書き攻撃回帰テスト) |

### コード変更タスク(追加条件)

- CDK を変更するタスクは `npm run synth`(または `npx cdk synth`)が成功している
- バックエンドを変更するタスクは `npm run smoke:backend` が成功している
- 本番リリース(development → main)は `docs/release-checklist.md` の全項目 ✅

### セキュリティ・プライバシーに関わるタスク(追加条件)

- Cognito / DynamoDB / IAM / CORS を変更するタスクは `/security-review` を実施し、人間オーナーが承認している
- `docs/risk-register.md` の該当リスクの状態を更新している

> **既存の「品質」行との整合**: PMP テーブルの品質行「DoD: lint/build green + トーンガイド準拠 + docs 更新 + 人間作業の human-todo 記録。受け入れ条件のないタスクは着手しない」はこのセクションの要約です。詳細はこのセクションを参照してください。

---

## Current Recommendation

Use GitHub Issues as durable task records and GitHub Projects as the board/roadmap view.

Why:

- Issues work well with PRs, CI, labels, and release history.
- Projects can show the same issues by status, priority, area, and iteration.
- Codex/Claude Code can work from issue descriptions and update status in docs/PRs.

## Automation Reality

GitHub Projects can be automated through the GitHub GraphQL API and GitHub CLI. GitHub's docs state that Projects can be managed with GraphQL, and the `gh project` command supports project creation, fields, and items when authenticated with the `project` scope.

Current local limitation:

- `gh` is not installed in this environment.
- The connected GitHub app tools available here can inspect some Actions data, but they do not expose GitHub Project creation/editing or repository secret inspection.

Practical approach:

1. Create the GitHub Project manually once, or run the bootstrap commands from a machine with `gh`.
2. Use issues as project items.
3. Use labels and issue templates so work stays structured even before full automation.

## Suggested GitHub Project

Project name:

```text
Care Quest MVP
```

Recommended views:

- Board by `Status`
- Table by `Priority`
- Roadmap by `Target`
- Area view grouped by `Area`

Recommended fields:

| Field | Type | Values |
| --- | --- | --- |
| Status | single select | Backlog, Ready, In progress, Blocked, Review, Done |
| Priority | single select | P0, P1, P2, P3 |
| Area | single select | Product, Frontend, Backend, AWS, GitHub, Docs, QA |
| Owner | text or assignees | Human, Codex, Claude Code, Shared |
| Estimate | text or number | 15m, 30m, 1h, 2h, 1d |
| Target | date | optional release/verification target |
| Automation | single select | Manual, Codex, Claude, GitHub Actions |

## Initial Issues

Create these issues and add them to the project.

### P1: Verify GitHub Actions production secrets

Area: GitHub
Owner: Human
Estimate: 10-20m

Acceptance criteria:

- `AWS_ACCESS_KEY_ID` exists.
- `AWS_SECRET_ACCESS_KEY` exists.
- `AWS_REGION=ap-northeast-1`.
- `S3_BUCKET=veai-jp-toc-web`.
- `CLOUDFRONT_DISTRIBUTION_ID=E32Z6UIZTZD6DE`.
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-northeast-1_INR8bI3WX`.
- `NEXT_PUBLIC_COGNITO_CLIENT_ID=7ghfrdbrthuvi86if1orlktesn`.
- `NEXT_PUBLIC_API_URL=https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/`.
- `NEXT_PUBLIC_AWS_REGION=ap-northeast-1`.

### P1: Decide release timing for merging development to main

Area: GitHub
Owner: Human
Estimate: 5-15m

Acceptance criteria:

- CI is green.
- `npm run smoke:prod` passes.
- Human owner is comfortable treating current MVP as the main branch state.

### P1: Run real-email Cognito sign-up smoke test

Area: QA
Owner: Human
Estimate: 15-30m

Acceptance criteria:

- Sign-up email/code arrives.
- User can confirm and sign in.
- User can create one care log.
- Page refresh does not break the experience.

### P2: Decide local-first vs AWS-first saving

Area: Product
Owner: Human
Estimate: 10-20m

Recommendation:

- Choose local-first for MVP.

Acceptance criteria:

- Decision is recorded in an issue comment or `docs/active-todo.md`.
- Implementation issue is created for Codex/Claude Code.

### P2: Implement selected storage sync behavior

Area: Frontend / Backend
Owner: Codex or Claude Code
Estimate: 1-3h

Acceptance criteria:

- Behavior matches the product decision.
- Signed-out behavior is clear.
- Signed-in sync has error handling.
- `npm run lint`, `npm run build`, `npm run smoke:backend`, and relevant manual checks pass.

### P2: Harden AWS infrastructure before real user data

Area: AWS
Owner: Codex or Claude Code
Estimate: 1-2h

Acceptance criteria:

- Cognito/DynamoDB removal policies are production-safe.
- CORS is narrowed where practical.
- Lambda log retention is explicit.
- Backend smoke test remains green.

## Labels

Create these labels:

```text
priority:P0
priority:P1
priority:P2
priority:P3
area:product
area:frontend
area:backend
area:aws
area:github
area:docs
area:qa
owner:human
owner:codex
owner:claude
status:blocked
```

## Manual Setup Steps

1. Open GitHub repository `larai-w/carequest`.
2. Create a new Project named `Care Quest MVP`.
3. Add the fields listed above.
4. Create the initial issues listed above.
5. Add each issue to the project.
6. Set `Priority`, `Area`, `Owner`, and `Estimate`.

## `gh` CLI Setup Path

If `gh` is installed later:

```bash
gh auth refresh -s project
gh project create --owner larai-w --title "Care Quest MVP"
gh project list --owner larai-w
```

To create the standard labels and initial issues:

```bash
scripts/github-issue-bootstrap.sh
```

After the project exists, add issues to it with:

```bash
gh project item-add PROJECT_NUMBER --owner larai-w --url ISSUE_URL
```

GitHub's current CLI project commands include project creation, field management, item creation, and item listing. For deeper automation, use the GraphQL API with a token that has `project` scope.

## Operating Rhythm

Weekly or before each work session:

1. Check `docs/active-todo.md`.
2. Check the GitHub Project board.
3. Pick the highest-priority `Ready` item.
4. Keep work in small PRs.
5. Move items to `Review` when a PR is pushed.
6. Move items to `Done` only after verification is recorded.
