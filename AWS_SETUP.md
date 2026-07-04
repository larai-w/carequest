# AWS 設定メモ

## 1. 前提
- AWS CLI がインストール済みで、`aws configure` で認証済みであること
- Node.js と npm が入っていること

## 2. CDK の準備

```bash
cd infra
npm install
npx cdk bootstrap
```

## 3. インフラをデプロイ

```bash
npx cdk deploy
```

## 4. 生成されるもの
- Cognito User Pool
- Cognito User Pool Client
- API Gateway
- Lambda
- DynamoDB

## 5. 今後の接続方針
- 認証: Cognito
- API: API Gateway + Lambda
- データ保存: DynamoDB
- ホスティング: Amplify Hosting

## 6. 既存アプリとの接続箇所
- ローカル保存は [lib/storage.ts](lib/storage.ts) に集約済み
- AWS へ移行する時は、この層を API 呼び出しに差し替える構造にしています
