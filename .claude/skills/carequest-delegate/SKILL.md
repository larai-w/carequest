---
name: carequest-delegate
description: Care Quest の「プランナーが立案し、ワーカー(Sonnet/Opus)が実装する」運用ワークフロー。タスクの委任・実行依頼・「次のタスクを進めて」と言われたとき、または複数タスクをまとめて処理するときに使う。
---

# Care Quest 委任ワークフロー(プランナー → ワーカー)

役割分担: **メインセッション(Fable 等の上位モデル)= プランナー**が戦略・タスク立案・レビュー・コミットを担い、**carequest-worker サブエージェント(Sonnet/Opus)= ワーカー**が実装する。この仕組みはすべてリポジトリ内(`.claude/agents/`, `.claude/skills/`, `docs/`)にあるため、どのユーザー・どのマシンでも同じように動く。

## プランナーの手順

1. **立案**: `docs/strategy.md` のユーザーストーリーから次のタスクを選び、`docs/task-list.md` に受け入れ条件つきで記載する(GitHub Issue があれば番号を対応づける)
2. **委任**: Agent ツールで `subagent_type: "carequest-worker"` を spawn する。エージェント定義はセッション開始時に読み込まれるため、`carequest-worker` が未登録の場合は `general-purpose` + `model` 指定で代替し、`.claude/agents/carequest-worker.md` の本文ルールをプロンプトに含める。プロンプトには次を必ず含める:
   - タスク1件の内容と受け入れ条件(コピーして渡す。参照だけにしない)
   - 対象ファイルのヒント(わかる範囲で)
   - 「コミットしない」ことの念押し
3. **モデル選択**(spawn 時の `model` パラメータ):

   | タスクの性質 | model |
   | --- | --- |
   | UI追加・文言・データ追加・小さめのリファクタ | `sonnet`(既定) |
   | 認証/同期/Service Worker/インフラ設計など難所 | `opus` |
   | 戦略・タスク立案・レビュー・リリース判断 | プランナー自身(委任しない) |

4. **レビュー**: ワーカーの報告を受けたら差分を確認し、lint/build を自分でも再実行。必要なら /code-review を使う。トーン(carequest-product-tone)逸脱は必ず直す
5. **確定**: `docs/task-list.md` のチェックを更新 → コミット(Co-Authored-By を付与)→ 人間の作業が発生したら `docs/human-todo.md` に追記
6. **並列化**: 依存のないタスクは複数ワーカーを並列で spawn してよい。同じファイルを触るタスクは直列にする

## ワーカーに委任しないもの

- `main` へのマージ、本番デプロイ、AWS への書き込み(人間の承認事項)
- プロダクト判断(ローカルファースト方針の変更など)
- `docs/strategy.md` の改訂

## 人間(リポジトリオーナー)の関与ポイント

`docs/human-todo.md` に集約する。典型: GitHub 認証・Secrets・実メールテスト・`cdk deploy`・development→main のリリース判断。

## GitHub 連携

- Issue/Project の一括作成: `scripts/github-project-bootstrap.sh`(要 `gh auth login` + `gh auth refresh -s project`。`GITHUB_OWNER`/`GITHUB_REPO` で他ユーザーのリポジトリにも使える)
- タスク完了時は該当 Issue をクローズ(`gh issue close <num> -c "完了コメント"`)
