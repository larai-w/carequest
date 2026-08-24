# CareQuest ドキュメント索引

**最終更新:** 2026-08-02
**管理:** VEAI CareQuest運用チーム

---

## 📚 ドキュメント体系

```
CareQuest Docs
├── README.md                    ← このファイル（索引）
├── operations-guide.md          ← 【統合版】運用ガイド（まずここ）
├── deployment-runbook.md        ← デプロイ詳細手順書
├── incident-response-carequest.md ← CareQuest固有障害対応
└── auth-architecture.md         ← 認証アーキテクチャ設計
```

---

## 🎯 目的別ガイド

### 日常運用
| やりたいこと | 参照先 |
|-------------|--------|
| 全体像を把握する | [operations-guide.md](operations-guide.md) |
| 日次/週次/月次タスク確認 | [operations-guide.md §5](operations-guide.md#5-日常運用) |
| SLO・エラーバジェット確認 | [operations-guide.md §3](operations-guide.md#3-sloエラーバジェット) |

### デプロイ
| やりたいこと | 参照先 |
|-------------|--------|
| 通常デプロイ | [deployment-runbook.md §3](deployment-runbook.md#3-通常デプロイ) |
| 緊急デプロイ | [deployment-runbook.md §4](deployment-runbook.md#4-緊急デプロイ) |
| ロールバック | [deployment-runbook.md §5](deployment-runbook.md#5-ロールバック) |
| デプロイ後確認 | [deployment-runbook.md §6](deployment-runbook.md#6-デプロイ後確認) |

### 障害対応
| やりたいこと | 参照先 |
|-------------|--------|
| インシデント分類 | [incident-response-carequest.md §1](incident-response-carequest.md#1-インシデント分類) |
| CareQuest固有シナリオ | [incident-response-carequest.md §2](incident-response-carequest.md#2-carequest固有シナリオ) |
| 初動チェックリスト | [incident-response-carequest.md §3](incident-response-carequest.md#3-初動対応チェックリスト) |
| ポストモーテム | [incident-response-carequest.md §5](incident-response-carequest.md#5-ポストモーテム) |

### 設計・アーキテクチャ
| やりたいこと | 参照先 |
|-------------|--------|
| 認証の仕組み理解 | [auth-architecture.md](auth-architecture.md) |
| システム構成図 | [operations-guide.md §2](operations-guide.md#2-アーキテクチャ) |

---

## 🔗 関連ドキュメント

SLO 定義、エラーバジェットポリシー、インシデント管理、エスカレーション、
復旧 Runbook、ポストモーテムのテンプレート、パイロット関連は**私有リポジトリ**に
ある。**内部のディレクトリ構成は公開しない**ため、ここには一覧を置かない。
場所はオーナーに確認すること。

---

## 📋 レビューサイクル

| ドキュメント | レビュー頻度 | 次回期限 |
|-------------|-------------|---------|
| operations-guide.md | 月次 | 2026-09-02 |
| deployment-runbook.md | 四半期 | 2026-11-02 |
| incident-response-carequest.md | 四半期 + 訓練後 | 2026-11-02 |
| auth-architecture.md | 変更時 | — |

---

## 🚨 緊急時の読み順

1. **[incident-response-carequest.md §3](incident-response-carequest.md#3-初動対応チェックリスト)** → 初動チェックリスト
2. **[incident-response-carequest.md §2](incident-response-carequest.md#2-carequest固有シナリオ)** → シナリオ別対応
3. **[deployment-runbook.md §5](deployment-runbook.md#5-ロールバック)** → ロールバック
4. **[operations-guide.md §6](operations-guide.md#6-障害対応フロー)** → 全体フロー

---

*B-02: CareQuest運用ドキュメント統合の一環として作成*