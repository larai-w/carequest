# インフラ構築手順

## 1. AWS CLI のインストール
macOS では AWS CLI v2 のインストーラを使います。

- ダウンロード済みの pkg を開いてインストールしてください
- インストール後に以下を実行してください

```bash
aws --version
```

## 2. AWS 認証
```bash
aws configure
```

以下を入力します。
- AWS Access Key ID
- AWS Secret Access Key
- Default region name: ap-northeast-1
- Default output format: json

## 3. CDK の bootstrap
```bash
cd infra
npm install
npx cdk bootstrap
```

## 4. インフラをデプロイ
```bash
npx cdk deploy
```

## 5. 次のステップ
- Cognito でユーザー作成
- API Gateway の URL を Frontend へ接続
- Amplify Hosting へデプロイ
