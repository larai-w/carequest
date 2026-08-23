# CareQuest 運用ガイド（統合版）

**作成日:** 2026-08-02
**作成者:** Cline
**対象:** CareQuest運用担当者 / パイロット施設サポート
**バージョン:** 1.0
**レビュー周期:** 月次

---

## 📋 目次

1. [システム概要](#1-システム概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [SLO・エラーバジェット](#3-sloエラーバジェット)
4. [デプロイ手順](#4-デプロイ手順)
5. [日常運用](#5-日常運用)
6. [障害対応フロー](#6-障害対応フロー)
7. [セキュリティ](#7-セキュリティ)
8. [パイロット施設向け](#8-パイロット施設向け)
9. [関連ドキュメント](#9-関連ドキュメント)

---

## 1. システム概要

### 1.1 プロダクト情報

| 項目 | 内容 |
|------|------|
| 名称 | CareQuest（ケアクエスト） |
| 目的 | 介護ケア記録のデジタル化 |
| 対象ユーザー | 介護施設スタッフ、家族 |
| 主要機能 | ケアクエスト回答・記録、履歴参照、テンプレート管理 |
| リポジトリ | `~/Developer/carequest` |

### 1.2 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 14 (App Router) |
| バックエンド | AWS Lambda (Node.js 20) |
| データベース | DynamoDB (PITR有効) |
| 認証 | Cognito User Pool |
| API | API Gateway |
| IaC | AWS CDK |
| CI/CD | GitHub Actions |

---

## 2. アーキテクチャ

### 2.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        CareQuest System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────────┐    │
│  │ Next.js  │────>│   API    │────>│   Lambda Functions   │    │
│  │   App    │     │ Gateway  │     │                      │    │
│  └──────────┘     └──────────┘     │  ┌────────────────┐  │    │
│       │                            │  │ Record Handler │  │    │
│       │                            │  └────────────────┘  │    │
│       ▼                            │  ┌────────────────┐  │    │
│  ┌──────────┐                      │  │  Get Handler   │  │    │
│  │ Cognito  │                      │  └────────────────┘  │    │
│  │User Pool │                      └──────────┬───────────┘    │
│  └──────────┘                                 │                 │
│                                               ▼                 │
│                                    ┌──────────────────┐        │
│                                    │    DynamoDB      │        │
│                                    │   (PITR有効)     │        │
│                                    └──────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 認証アーキテクチャ

詳細: `docs/auth-architecture.md`

- **共通User Pool:** VEAIエコシステム全体で共有
- **アプリ別Client:** CareQuest専用Client（SRP+PWD認証）
- **Cross-Stack Export:** `VeaiSharedUserPoolId`

---

## 3. SLO・エラーバジェット

### 3.1 SLO定義

| SLI | SLO（目標） | 測定方法 |
|-----|------------|---------|
| 可用性 | 99.5% | CloudWatch Synthetics |
| レイテンシ p95 | < 800ms | API Gateway Latency |
| エラー率 | < 1% | Lambda Errors/Invocations |
| **耐久性** | **99.9%** | DynamoDB書込成功率 |

> **最重要:** 耐久性99.9%。ケア記録の損失は介護事故・コンプライアンスリスクに直結。

### 3.2 エラーバジェット

| SLI | 月間許容 |
|-----|---------|
| 可用性 | 3.6時間 |
| 耐久性 | 原則ゼロ（違反時は即時インシデント） |

### 3.3 バジェット消費ルール

| 消費率 | アクション |
|--------|-----------|
| < 50% | 機能開発継続 |
| 50-100% | 安定性改善優先 |
| > 100% | 🔴 新機能凍結、安定性集中 |

---

## 4. デプロイ手順

### 4.1 通常デプロイ

```bash
# 1. リポジトリ移動
cd ~/Developer/carequest

# 2. 依存関係インストール
npm install

# 3. テスト実行
npm test

# 4. CDKデプロイ（本番）
cd infra
npx cdk deploy CareQuestStack --require-approval never
```

### 4.2 CI/CDパイプライン

| ワークフロー | トリガー | 内容 |
|-------------|---------|------|
| `ci.yml` | PR作成 | Lint, Test, Build |
| `deploy-prod.yml` | main push | CDK Deploy |
| `security-baseline.yml` | 日次 | gitleaks, npm audit |
| `synthetic-check.yml` | 5分間隔 | 可用性監視 |

### 4.3 ロールバック

```bash
# Lambdaロールバック
~/Developer/veai-private/governance/scripts/auto-recovery/lambda-rollback.sh CareQuestStack

# DynamoDB復旧（PITR）
~/Developer/veai-private/governance/scripts/auto-recovery/dynamodb-pitr-restore.sh carequest-records "2026-08-02T12:00:00Z"
```

---

## 5. 日常運用

### 5.1 日次チェック

| 項目 | 確認方法 | 閾値 |
|------|---------|------|
| 可用性 | CloudWatch Dashboard | ≥ 99.5% |
| エラー率 | Lambda Metrics | < 1% |
| p95レイテンシ | API Gateway | < 800ms |

### 5.2 週次タスク

| タスク | 実行方法 |
|--------|---------|
| DORA指標測定 | `~/Developer/veai-private/governance/scripts/dora-metrics-measure.sh` |
| コストレポート | `~/Developer/veai-private/governance/scripts/cost-report.sh` |
| セキュリティスキャン | GitHub Actions自動実行 |

### 5.3 月次タスク

| タスク | 期限 |
|--------|------|
| SLO実績レビュー | 月末 |
| エラーバジェット消費確認 | 月末 |
| 依存関係アップデート | 月末 |

---

## 6. 障害対応フロー

### 6.1 インシデント重大度

| 重大度 | 定義 | 対応時間 |
|--------|------|---------|
| SEV1 | 記録データ損失/耐久性違反 | 即時 |
| SEV2 | 可用性SLO違反（99.5%割れ） | 1時間以内 |
| SEV3 | 一部機能障害 | 4時間以内 |
| SEV4 | 軽微な問題 | 次営業日 |

### 6.2 対応フロー

```
障害検知
    │
    ▼
┌─────────────┐
│ 影響範囲確認 │ ← CloudWatch, ユーザー報告
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 重大度判定   │ ← SEV1-4
└──────┬──────┘
       │
       ├── SEV1 → 即時対応 + エスカレーション
       │
       ▼
┌─────────────┐
│ 初動対応     │ ← ロールバック/復旧
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 原因調査     │ ← ログ分析
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ポストモーテム│ ← 再発防止
└─────────────┘
```

### 6.3 エスカレーション

| レベル | 条件 | 連絡先 |
|--------|------|--------|
| L1 | 通常障害 | 運用担当 |
| L2 | SEV2以上 | オーナー |
| L3 | SEV1 / データ損失 | オーナー + 経営 |

---

## 7. セキュリティ

### 7.1 認証設定

| 項目 | 設定 |
|------|------|
| パスワードポリシー | 8文字以上、大文字小文字数字必須 |
| メール検証 | 自動検証有効 |
| SRP認証 | 有効 |
| ユーザー存在隠蔽 | 有効 |

### 7.2 セキュリティスキャン

| ツール | 頻度 | 対象 |
|--------|------|------|
| gitleaks | 日次 | シークレット検出 |
| npm audit | 日次 | 依存関係脆弱性 |
| CodeQL | PR時 | コード品質 |

### 7.3 個人情報保護

- DP-02 Safety & Trust: 個人を特定する行動追跡はしない
- ADR-0005: 測定プライバシーポリシー準拠
- 施設側の同意を得てから導入

---

## 8. パイロット施設向け

導入前チェックリスト・トレーニング日程・サポート体制・フィードバック収集は
パイロット計画に当たるため、私有リポジトリで管理する
（`veai-private/carequest/pilot-onboarding-plan.md`）。

---

## 9. 関連ドキュメント

| ドキュメント | 場所 |
|-------------|------|
| 認証アーキテクチャ | `docs/auth-architecture.md` |
| SLO定義 | `veai-private/governance/slo/carequest.md` |
| エラーバジェットポリシー | `veai-private/governance/error-budget-policy.md` |
| インシデント管理 | `veai-private/governance/incident-management.md` |
| パイロット施設候補 | `veai-private/governance/pilot-facility-candidates.md` |
| 共創プレイブック | `veai-private/governance/co-creation-playbook.md` |
| DynamoDB復旧Runbook | `veai-private/knowledge/runbooks/RB-0001-dynamodb-pitr-recovery.md` |
| Lambdaロールバック | `veai-private/knowledge/runbooks/RB-0002-lambda-rollback.md` |

---

## 改訂履歴

| 日付 | 変更内容 | 変更者 |
|------|---------|--------|
| 2026-08-02 | 初版作成（B-02運用ドキュメント統合） | Cline |

---

*このドキュメントはCareQuest運用の単一情報源（Single Source of Truth）。*
*月次でレビューし、最新状態を維持する。*