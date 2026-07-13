# Care Quest

https://veai.jp/carequest/

Care Quest は、家族介護者が今日できたことをやさしく記録できる Web アプリです。介護を「もっとやらせる」ためではなく、疲れた夜に「今日をそのまま認める」ための場所として設計しています。競わせず、責めず、押し付けない — それが Care Quest の基本姿勢です。

## ビジョン

- **あなたは孤独ではない、を静かに示す。** 介護は重く、話せば苦労話になる。だから会話を強いない。それでも「他の誰かも今日、介護に向き合っている」ことが伝わるアプリを目指す(例: 「今日のともしび」= 匿名の実データ集計)
- **在宅介護に役立つアプリ群の、中心的なコミュニティ機能を担う。** 今後リリースする介護アプリのハブとして育てる
- **介護者はずっと無料。広告も入れない。** 収益はユーザー以外(自治体・介護事業者への導入、助成金、CSR 協賛)から得る([docs/strategy.md](docs/strategy.md) 参照)

## 主な機能

- タップだけの介護記録(10秒以内・文字入力不要)+ カスタムタスク
- ふりかえり(今日の記録・過去7日のあゆみ・よかったこと・ひとこと)
- 休息モード(「今日は無理しない」を許可する)/ エネルギーレベルが低い日が続いたら相談窓口をそっと案内
- **登録なしで全機能が使える**(記録は端末の localStorage に保存・ローカルファースト)
- 任意のアカウント登録で: クラウドバックアップ/復元・自動同期・別端末での復元・アプリ内でのアカウント/クラウドデータ削除
- 記録の書き出し: JSON(完全バックアップ)/ CSV(表計算・共有・印刷向け)
- PWA(ホーム画面に追加・オフライン動作)
- 今日のともしび: 「今日、◯人の介護者が記録しました」(匿名・実データ・5人未満の日は数字を出さない)

## ローカル開発の始め方

```bash
# 依存パッケージのインストール
npm install

# 開発サーバーの起動（http://localhost:3000/carequest）
npm run dev

# ユニットテスト
npm test

# E2E テスト（Playwright）
npm run test:e2e

# 本番ビルド（静的エクスポートを out/ に生成）
npm run build
```

インフラ（CDK）の確認:

```bash
cd infra && npm test   # Lambda ユニット + CDK assertions
cd infra && npm run synth
```

## アーキテクチャ概要

- **フロントエンド**: Next.js 16 静的エクスポート（`output: "export"`、`basePath: /carequest`）
- **ホスティング**: AWS S3（`veai-jp-toc-web/carequest/`）+ CloudFront（`veai.jp/carequest/`）
- **バックエンド（任意サインイン用）**: API Gateway + Lambda（`infra/lambda/entries/index.js`）+ DynamoDB
- **認証**: Amazon Cognito（サインインなしでも全記録機能が使える。AWS 同期はサインイン後の enhancement）
- **Service Worker の VERSION**: `npm run build` の postbuild で git SHA + 日付が自動注入される。手動変更は不要

データはデフォルトで `localStorage` に保存されます。サインインすると AWS バックエンドへの同期が有効になります（ローカルファースト設計）。

## ブランチ運用

- `main`: 本番反映用。`main` への push で GitHub Actions が自動デプロイ
- `development`: 開発・検証用。Pull Request は `development` へ集約

## CI

GitHub Actions で以下を自動実行します。

- **web**: audit → lint → test → build（`main` / `development` への push と PR 時）
- **e2e**: Playwright E2E テスト（PR 時）
- **infra**: build → test → synth（`main` / `development` への push と PR 時）
- **synthetic-check**: 本番ヘルスチェック（6時間ごと）
- **deploy-prod**: 静的サイトのデプロイ（`main` への push 時）
- **Dependabot**: 依存パッケージの週次更新（root / infra / GitHub Actions）

## デプロイ

`main` への push で GitHub Actions が静的ファイルを `s3://veai-jp-toc-web/carequest/` に同期し、CloudFront の `/carequest/*` をキャッシュ無効化します。必要な Secrets と CloudFront/S3 構成は [docs/deploy.md](docs/deploy.md) を参照してください。

## docs/ への案内（推奨読む順）

| 目的 | ドキュメント |
|---|---|
| アーキテクチャ・戦略の全体像 | [docs/strategy.md](docs/strategy.md) |
| 設計原則（「頑張らせない」の根拠） | [docs/design-principles.md](docs/design-principles.md) |
| デプロイ手順・AWS 構成・IAM | [docs/deploy.md](docs/deploy.md) |
| 人間(オーナー)がやること | [docs/human-todo.md](docs/human-todo.md) |
| リリースチェックリスト | [docs/release-checklist.md](docs/release-checklist.md) |
| 本番障害対応（Runbook） | [docs/runbook.md](docs/runbook.md) |
| リスク登録簿 | [docs/risk-register.md](docs/risk-register.md) |
| ローカル→AWS 同期設計 | [docs/design-sync.md](docs/design-sync.md) |
| タスク一覧 | [docs/task-list.md](docs/task-list.md) |
