# Care Quest 運用 Runbook

最終更新: 2026-07-10 JST

このドキュメントは ITIL インシデント管理に基づいた初動手順書です。アラート検知から恒久対策 Issue 化までの流れを定義します。`docs/deploy.md` と矛盾しないよう、デプロイ手順の詳細は `docs/deploy.md` を参照してください。

---

## 目次

1. [アラート種別と初動](#1-アラート種別と初動)
   - 1-A. Lambda エラーアラーム
   - 1-B. API Gateway 5XX アラーム
   - 1-C. 月額コスト超過アラート
2. [スモークテストの使い方](#2-スモークテストの使い方)
3. [ロールバック手順](#3-ロールバック手順)
4. [エスカレーション](#4-エスカレーション)
5. [恒久対策への移行](#5-恒久対策への移行)

---

## 1. アラート種別と初動

### 1-A. Lambda エラーアラーム (`CareQuest-Lambda-Errors`)

**条件**: `CareQuestApiHandler` の `Errors` メトリクスが 5 分間で 1 件以上

#### 確認するログ・メトリクス

| 確認対象 | 場所 / コマンド |
|---|---|
| Lambda ログ | CloudWatch > ロググループ `/aws/lambda/CareQuestStack-CareQuestApiHandler*` > 最新のログストリーム |
| エラー詳細 | ログ内の `ERROR` / `console.error` 行を確認。スタックトレースから原因を特定 |
| DynamoDB スロットリング | CloudWatch > メトリクス > DynamoDB > `ThrottledRequests`(テーブル名 `CareQuestStack-CareQuestEntriesTable*`) |
| 呼び出し回数 | CloudWatch > Lambda > `CareQuestApiHandler` > `Invocations` / `Errors` のグラフ |

#### よくある原因と対処

| 原因 | 症状 | 対処 |
|---|---|---|
| DynamoDB 接続エラー | ログに `ResourceNotFoundException` または `ProvisionedThroughputExceededException` | DynamoDB コンソールでテーブル状態確認。PAY_PER_REQUEST なのでスロットリングは一時的なことが多い。再試行で復旧するか監視継続 |
| 環境変数 `TABLE_NAME` 未設定 | ログに `Cannot read properties of undefined` | CDK デプロイが中途半端な状態。`cdk diff` → `cdk deploy` で再デプロイ |
| メモリ不足 / タイムアウト | ログに `Process exited before completing request` または `Task timed out` | Lambda のメモリ設定・タイムアウト設定を確認してスタックを更新 |
| コードのロジックエラー | ログに JavaScript の例外 | 直前のデプロイ内容を確認。必要ならロールバック(手順 3 参照) |

#### 初動チェックリスト

```
[ ] CloudWatch アラームのステータスを確認(ALARM / OK)
[ ] /aws/lambda/CareQuestStack-CareQuestApiHandler* の最新ログを確認
[ ] npm run smoke:backend でヘルスチェック実施
[ ] エラーが継続中 → ロールバック判断(手順 3)
[ ] エラーが散発的 → 根本原因を Issue 化して監視継続
```

---

### 1-B. API Gateway 5XX アラーム (`CareQuest-ApiGateway-5XX`)

**条件**: API Gateway の `5XXError` メトリクスが 5 分間で 1 件以上

#### 確認するログ・メトリクス

| 確認対象 | 場所 / コマンド |
|---|---|
| API Gateway アクセスログ | CloudWatch > ロググループ `API-Gateway-Execution-Logs_<API_ID>/dev` |
| API Gateway メトリクス | CloudWatch > API Gateway > `CareQuest API` > `5XXError` / `4XXError` / `Latency` |
| Lambda エラーとの相関 | 同時刻の Lambda エラーログと照合 |
| X-Ray トレース(将来) | 現在は X-Ray 未設定。相関は CloudWatch Logs のタイムスタンプで行う |

API URL: `https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/`

#### よくある原因と対処

| 原因 | 症状 | 対処 |
|---|---|---|
| Lambda 関数がクラッシュ | API ログに `502 Bad Gateway` | Lambda エラー手順(1-A)と並行して調査 |
| Lambda タイムアウト | API ログに `503 Service Unavailable` または `Endpoint request timed out` | Lambda タイムアウト設定を延長 or 処理を軽量化 |
| IAM 権限不足 | API ログに `502` + Lambda ログに `Access Denied` | Lambda 実行ロールの DynamoDB 権限を確認 |
| Cognito Authorizer エラー | API ログに `401` / `403`(4XX は別アラームだが確認) | Cognito User Pool の状態を確認。クライアントの JWT トークンが期限切れの場合は正常動作 |

#### 初動チェックリスト

```
[ ] npm run smoke:backend でヘルスエンドポイント確認(認証不要のため最初に確認)
[ ] API Gateway コンソール > ステージ dev > ログを確認
[ ] Lambda ログと時刻を照合して根本原因を特定
[ ] 5XX が継続 → ロールバック判断(手順 3)
[ ] 散発的 → 根本原因を Issue 化
```

---

### 1-C. 月額コスト超過アラート (`CareQuestMonthlyBudget`)

**条件**: 月間実際コストが予算(10 USD)の 80% を超過

> このアラートは緊急度が低めですが、料金スパイクがある場合は原因を特定する必要があります。

#### 確認するログ・メトリクス

| 確認対象 | 場所 |
|---|---|
| コスト内訳 | AWS Cost Explorer > サービス別コスト > 当月 |
| API リクエスト数 | CloudWatch > API Gateway > `Count` メトリクス |
| Lambda 実行時間 | CloudWatch > Lambda > `Duration` / `Invocations` |
| DynamoDB 消費 | CloudWatch > DynamoDB > `ConsumedReadCapacityUnits` / `ConsumedWriteCapacityUnits` |

#### よくある原因と対処

| 原因 | 症状 | 対処 |
|---|---|---|
| 予期しない大量リクエスト | API Count が急増 | API Gateway のリソースポリシーまたはスロットリングを設定 |
| Lambda の実行時間増加 | Duration が増加 | DynamoDB スロットリングや外部依存の問題と合わせて調査 |
| ログの保存量増加 | CloudWatch Logs コストが急増 | ログ保持期間は 90 日(RETAIN)設定済みのため通常は問題なし |

#### 初動チェックリスト

```
[ ] Cost Explorer で当月のサービス別コストを確認
[ ] 異常なコストのサービスを特定
[ ] Lambda / API Gateway のメトリクスで異常なリクエスト数がないか確認
[ ] 必要に応じてスロットリングルールを追加
[ ] 予算の見直しが必要な場合は人間オーナーに報告してエスカレーション
```

---

## 2. スモークテストの使い方

Care Quest には 2 つのスモークテストがあります。インシデント調査時は状況に応じて使い分けてください。

### `npm run smoke:backend` — バックエンド(API)の疎通確認

```bash
# プロジェクトルートで実行
npm run smoke:backend
```

- **何をチェックするか**: `GET /health` エンドポイントが HTTP 200 を返すか
- **使うタイミング**:
  - Lambda エラーアラームまたは API Gateway 5XX アラームが発報したとき
  - CDK デプロイ後の動作確認
  - `NEXT_PUBLIC_API_URL` 環境変数で向き先を変更可能(デフォルト: 本番 API)
- **成功時の出力例**: `{"status":"ok"}`
- **失敗時**: HTTP エラーコードが表示される。Lambda ログと照合して原因を特定

### `npm run smoke:prod` — フロントエンド(本番 URL)の疎通確認

```bash
# プロジェクトルートで実行
npm run smoke:prod
```

- **何をチェックするか**: `https://veai.jp/carequest/` 以下の主要ページが HTTP 200 を返すか
- **チェック対象 URL**:
  - `/carequest/`
  - `/carequest/quest/`
  - `/carequest/community/`
  - `/carequest/reflection/`
- **使うタイミング**:
  - フロントエンドデプロイ後の確認
  - CloudFront / S3 の問題を疑うとき
  - `CAREQUEST_PROD_URL` 環境変数で向き先を変更可能
- **失敗時**: 対象 URL と HTTP ステータスコードが表示される。CloudFront / S3 の設定を確認

---

## 3. ロールバック手順

### 3-A. アプリケーションコードのロールバック(main ブランチ revert → CI デプロイ)

問題のあるコミットを特定したら、main ブランチで revert コミットを作成して CI デプロイします。

```bash
# 1. main ブランチで問題のコミットを確認
git log --oneline main | head -10

# 2. 問題のコミットを revert(マージコミットの場合は -m 1 を追加)
git checkout main
git revert <問題のコミットハッシュ> --no-edit

# 3. プッシュ → GitHub Actions が自動デプロイ
git push origin main

# 4. デプロイ完了後に smoke テストで確認
npm run smoke:prod
npm run smoke:backend
```

> デプロイの詳細は `docs/deploy.md` を参照。GitHub Actions のワークフロー設定は `.github/workflows/` を確認してください。

### 3-B. インフラ(CDK)のロールバック

CDK スタックの変更が原因の場合は、直前の CloudFormation スタック状態に戻します。

```bash
# 1. infra ディレクトリに移動
cd infra

# 2. 直前の正常状態のコミットのコードを確認
git log --oneline -- lib/carequest-stack.ts | head -5

# 3. CDK diff で差分確認
npx cdk diff

# 4. ロールバック対象の状態を checkout して synth 確認
git show <正常時のコミットハッシュ>:infra/lib/carequest-stack.ts > /tmp/carequest-stack-prev.ts
# 内容確認後、lib/carequest-stack.ts を上書き

# 5. ビルドと synth を確認
npm run build && npm run synth

# 6. デプロイ(人間オーナーが実施)
npx cdk deploy
```

**重要な注意事項**:
- `removalPolicy: RETAIN` が設定されているリソース(UserPool・DynamoDB テーブル・ロググループ)はスタック削除時も保持されます。データ消失の心配はありません
- `cdk deploy` 前に必ず `cdk diff` で変更内容を確認してください
- CORS 設定の変更がある場合は `docs/deploy.md` の「CloudFront checklist」を参照してください

### 3-C. ロールバックの優先順位

```
1. フロントエンドのみの問題 → 3-A (CDK は触らない)
2. Lambda / API のみの問題 → 3-A (CDK は触らない)
3. インフラ設定(アラーム・CORS など)の問題 → 3-B
4. 両方の問題 → 3-A を先に実施してユーザー影響を止めてから 3-B
```

---

## 4. エスカレーション

### エスカレーション先

**人間オーナー(スポンサー)** が最終判断権限者です。

以下の状況では AI エージェントは自己判断せず、速やかに人間オーナーへ報告してください。

| 状況 | 理由 |
|---|---|
| データ損失・漏洩の可能性 | Cognito / DynamoDB の個人情報に関わるため |
| ロールバックで復旧しないインシデント | 構造的な問題の可能性があり、調達・費用の判断が必要 |
| AWS 費用が予算の 150% を超過 | 財務判断が必要 |
| Cognito や DynamoDB の手動操作が必要 | 秘匿情報・本番データの操作は人間のみ |
| セキュリティインシデントの疑い | 不正アクセス・API キー漏洩など |

### エスカレーション時の報告フォーマット

```
【インシデント報告】
発生日時: YYYY-MM-DD HH:MM JST
アラーム名: (例: CareQuest-Lambda-Errors)
症状: (何が起きているか)
影響範囲: (ユーザーへの影響)
確認済み事項: (調査済みのこと)
実施済み対処: (試みたこと)
判断を求めること: (人間オーナーに決めてほしいこと)
```

---

## 5. 恒久対策への移行

インシデント収束後は「問題管理」フェーズに移行します。

```
1. 根本原因を GitHub Issue に記録
   - タイトル: [問題管理] <インシデント概要>
   - ラベル: priority:P1, area:backend または area:aws
   - 本文: 発生日時・症状・根本原因・暫定対処・恒久対策案

2. 教訓を .claude/skills/ に反映
   - 繰り返し発生しそうなパターンはスキルドキュメントに追記

3. アラートしきい値の見直し(必要な場合)
   - 誤検知が多い場合は threshold や evaluationPeriods を調整
   - 変更は CDK コードで管理し、cdk deploy で反映(人間が実施)
```

---

## 付録: 関連リソース

| リソース | 場所 |
|---|---|
| API エンドポイント | `https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/` |
| 本番 URL | `https://veai.jp/carequest/` |
| CloudFront Distribution | `E32Z6UIZTZD6DE` |
| S3 バケット | `veai-jp-toc-web`(プレフィックス: `carequest/`) |
| CDK スタック | `CareQuestStack`(ap-northeast-1) |
| Lambda ロググループ | `/aws/lambda/CareQuestStack-CareQuestApiHandler*` |
| SNS トピック | `CareQuestAlerts` |
| CloudWatch アラーム | `CareQuest-Lambda-Errors`、`CareQuest-ApiGateway-5XX` |
| AWS Budgets | `CareQuestMonthlyBudget`(月 10 USD) |
| デプロイ手順 | `docs/deploy.md` |
| インフラコード | `infra/lib/carequest-stack.ts` |
