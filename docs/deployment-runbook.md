# CareQuest デプロイ手順書

**作成日:** 2026-08-02
**作成者:** Cline
**対象:** CareQuestデプロイ担当者
**バージョン:** 1.0

---

## 📋 目次

1. [前提条件](#1-前提条件)
2. [環境情報](#2-環境情報)
3. [通常デプロイ](#3-通常デプロイ)
4. [緊急デプロイ](#4-緊急デプロイ)
5. [ロールバック](#5-ロールバック)
6. [デプロイ後確認](#6-デプロイ後確認)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. 前提条件

### 1.1 必要なツール

| ツール | バージョン | 確認コマンド |
|--------|-----------|-------------|
| Node.js | ≥ 20.x | `node -v` |
| npm | ≥ 10.x | `npm -v` |
| AWS CDK | ≥ 2.x | `npx cdk --version` |
| AWS CLI | ≥ 2.x | `aws --version` |

### 1.2 必要な権限

| 権限 | 用途 |
|------|------|
| AWS_PROFILE設定 | `~/.aws/credentials` |
| CDK Bootstrap済み | `cdk bootstrap` |
| GitHub Actions Secrets | 自動デプロイ用 |

### 1.3 デプロイ前チェック

```bash
# 1. AWS認証確認
aws sts get-caller-identity

# 2. CDK Bootstrap確認
aws cloudformation describe-stacks --stack-name CDKToolkit

# 3. リポジトリ状態確認
cd ~/Developer/carequest
git status
git log --oneline -3
```

---

## 2. 環境情報

### 2.1 AWS環境

| 項目 | 値 |
|------|-----|
| リージョン | ap-northeast-1 |
| アカウント | [要確認] |
| スタック名 | CareQuestStack |
| User Pool Export | VeaiSharedUserPoolId |

### 2.2 リポジトリ構造

```
carequest/
├── app/                    # Next.js アプリ
│   ├── quest/             # ケアクエスト画面
│   └── ...
├── infra/                  # CDK インフラ
│   ├── lib/
│   │   └── carequest-stack.ts
│   └── bin/
├── docs/                   # ドキュメント
│   ├── auth-architecture.md
│   ├── operations-guide.md
│   └── deployment-runbook.md  # ← このファイル
└── .github/workflows/      # CI/CD
    ├── ci.yml
    ├── deploy-prod.yml
    ├── security-baseline.yml
    └── synthetic-check.yml
```

---

## 3. 通常デプロイ

### 3.1 手動デプロイ

```bash
# Step 1: リポジトリ移動
cd ~/Developer/carequest

# Step 2: 最新コード取得
git pull origin main

# Step 3: 依存関係インストール
npm install
cd infra && npm install && cd ..

# Step 4: テスト実行
npm test

# Step 5: ビルド確認
npm run build

# Step 6: CDK差分確認
cd infra
npx cdk diff

# Step 7: デプロイ（確認あり）
npx cdk deploy CareQuestStack

# Step 8: デプロイ確認
aws cloudformation describe-stacks --stack-name CareQuestStack --query 'Stacks[0].StackStatus'
```

### 3.2 自動デプロイ（GitHub Actions）

mainブランチへのpushで自動実行:

```yaml
# .github/workflows/deploy-prod.yml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npx cdk deploy --require-approval never
```

### 3.3 デプロイフロー

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  PR作成     │────>│  CI実行     │────>│  レビュー   │
│             │     │ (ci.yml)    │     │  承認       │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  監視確認   │<────│  デプロイ   │<────│  main merge │
│  (5分)      │     │ (自動)      │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 4. 緊急デプロイ

### 4.1 緊急デプロイ基準

| 条件 | 対応 |
|------|------|
| SEV1（データ損失） | 即時デプロイ + ロールバック準備 |
| SEV2（可用性違反） | 1時間以内デプロイ |
| セキュリティ脆弱性 | Critical: 即時 / High: 24時間以内 |

### 4.2 緊急デプロイ手順

```bash
# 1. 修正ブランチ作成
git checkout -b hotfix/issue-xxx

# 2. 修正・テスト
npm test

# 3. 直接デプロイ（レビュー省略可）
cd infra
npx cdk deploy CareQuestStack --require-approval never

# 4. 事後PR作成
git push origin hotfix/issue-xxx
# GitHubでPR作成、mainへマージ
```

---

## 5. ロールバック

### 5.1 Lambdaロールバック

```bash
# 自動復旧スクリプト使用
~/Developer/veai-private/governance/scripts/auto-recovery/lambda-rollback.sh CareQuestStack

# 手動ロールバック
aws lambda update-function-code \
  --function-name carequest-record-handler \
  --image-uri <previous-version-arn>
```

### 5.2 CloudFormationロールバック

```bash
# スタックの previous revision 確認
aws cloudformation describe-stack-events --stack-name CareQuestStack | head -50

# ロールバック実行
aws cloudformation rollback-stack --stack-name CareQuestStack
```

### 5.3 DynamoDB復旧（PITR）

```bash
# 特定時点への復旧
~/Developer/veai-private/governance/scripts/auto-recovery/dynamodb-pitr-restore.sh \
  carequest-records \
  "2026-08-02T12:00:00Z"
```

### 5.4 ロールバック判断基準

| 症状 | 判断 |
|------|------|
| エラー率 > 5% | 即時ロールバック |
| p95 > 2000ms 継続 | ロールバック検討 |
| データ不整合 | 即時ロールバック + PITR |

---

## 6. デプロイ後確認

### 6.1 正常性チェック

```bash
# 1. スタック状態確認
aws cloudformation describe-stacks --stack-name CareQuestStack \
  --query 'Stacks[0].StackStatus'
# 期待値: CREATE_COMPLETE or UPDATE_COMPLETE

# 2. Lambda関数確認
aws lambda get-function --function-name carequest-record-handler \
  --query 'Configuration.LastUpdateStatus'
# 期待値: Successful

# 3. API Gateway確認
curl -s https://<api-id>.execute-api.ap-northeast-1.amazonaws.com/prod/health
# 期待値: {"status":"ok"}
```

### 6.2 CloudWatch確認

| メトリクス | 閾値 | 確認場所 |
|-----------|------|---------|
| Errors | < 1% | Lambda Metrics |
| Latency p95 | < 800ms | API Gateway |
| 4xx/5xx | < 0.1% | API Gateway |

### 6.3 Synthetic確認

```bash
# Synthetics実行結果確認
aws synthetics get-canary --name carequest-synthetic \
  --query 'Canary.Status.State'
# 期待値: RUNNING
```

---

## 7. トラブルシューティング

### 7.1 よくある問題

| 問題 | 原因 | 解決策 |
|------|------|--------|
| `CDKToolkit not found` | Bootstrap未実行 | `cdk bootstrap` |
| `Access Denied` | IAM権限不足 | AWS_PROFILE確認 |
| `npm install`失敗 | Nodeバージョン不一致 | `nvm use 20` |
| デプロイタイムアウト | リソース競合 | `cdk destroy` → 再デプロイ |

### 7.2 ログ確認

```bash
# Lambda ログ
aws logs tail /aws/lambda/carequest-record-handler --follow

# CloudTrail イベント
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=UpdateStack \
  --max-results 10
```

### 7.3 エスカレーション

| レベル | 条件 | 連絡先 |
|--------|------|--------|
| L1 | 通常トラブル | 運用担当 |
| L2 | ロールバック必要 | オーナー |
| L3 | データ損失 | オーナー + 経営 |

---

## 関連ドキュメント

| ドキュメント | 場所 |
|-------------|------|
| 運用ガイド | `docs/operations-guide.md` |
| 認証アーキテクチャ | `docs/auth-architecture.md` |
| LambdaロールバックRunbook | `veai-private/knowledge/runbooks/RB-0002-lambda-rollback.md` |
| DynamoDB PITR復旧 | `veai-private/knowledge/runbooks/RB-0001-dynamodb-pitr-recovery.md` |

---

## 改訂履歴

| 日付 | 変更内容 | 変更者 |
|------|---------|--------|
| 2026-08-02 | 初版作成（B-03デプロイ手順書） | Cline |

---

*このドキュメントはデプロイ作業の標準手順書。*
*四半期でレビューし、最新状態を維持する。*