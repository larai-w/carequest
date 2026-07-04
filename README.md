# Care Quest

Care Quest は、家族介護者が今日できた介護をやさしく記録できる Web アプリの MVP です。競争ではなく、今日できたことに意味を見つけられる体験を重視しています。

## インストール方法

```bash
npm install
```

## ローカル実行方法

```bash
npm run dev
```

ブラウザで http://localhost:3000/carequest を開いてください。

## 公開 URL

本番では `veai.jp/carequest` 配下で公開する前提です。Next.js の `basePath` は `/carequest` に設定しています。

## ブランチ運用

- `main`: 本番反映用
- `development`: 開発・検証用
- Pull Request は `development` へ集約し、確認後に `main` へマージします。

## CI

GitHub Actions で `main` / `development` への push と Pull Request 時に以下を確認します。

- Web: lint と production build
- Infra: TypeScript build と CDK synth

## デプロイ

本番デプロイは `main` への反映時に GitHub Actions で `veai.jp/carequest/` へ配信します。必要な GitHub Secrets と CloudFront/S3 設定は [docs/deploy.md](docs/deploy.md) を参照してください。

## 現在の MVP 機能

- ホーム画面: 今日のポイント、励ましメッセージ、エネルギーレベル選択
- クエスト画面: 介護タスクをタップして記録
- みんな画面: 今日のコミュニティの進捗をモック表示
- ふりかえり画面: 今日の記録とひとことメモ
- About 画面: アプリの説明と安全に関する注意

## データ保存

- localStorage にユーザー状態、介護ログ、ふりかえりメモを保存します。
- AWS 移行時は、lib/storage.ts の保存処理を API Gateway + Lambda + DynamoDB へ置き換える構造にしています。

## 将来の AWS 構成案

- 認証: Amazon Cognito
- API: API Gateway + Lambda
- DB: DynamoDB
- ホスティング: AWS Amplify Hosting
- 励ましメッセージ: テンプレートをベースに、将来的に Amazon Bedrock を連携
