# Care Quest リリースチェックリスト

Last updated: 2026-07-10 JST

このドキュメントは **承認ルールとチェックリスト** に徹します。手順の詳細は各参照先を見てください。

- デプロイ手順・AWS 構成: `docs/deploy.md`
- 人間がやること・リリース判断: `docs/human-todo.md`
- 本番障害対応: `docs/runbook.md`（T14 で別途作成）

---

## 1. 変更タイプと承認マトリクス

ITIL 4「変更有効化(Change enablement)」を 1 人+AI 体制に合わせて定義します。

| 変更タイプ | 対象の例 | 承認者 | 本番反映 |
|---|---|---|---|
| **標準変更**（事前承認・低リスク） | 文言修正、タスクデータ追加、`docs/` 更新 | プランナー（Fable 等） | `development` へのコミットまで可。main マージは通常変更として扱う |
| **通常変更**（個別承認） | 新機能、依存パッケージ追加、インフラ変更、`development → main` マージ（＝本番リリース） | **人間オーナー** | 下記「リリースチェックリスト」を全項目 ✅ にしてから実施 |
| **緊急変更**（本番障害時） | 本番を壊している最小修正のみ | 人間オーナー（事後レビュー可） | `docs/runbook.md` の緊急手順に従う。事後に通常変更として Issue 化・レビューする |

> **判断に迷ったら通常変更として扱う。** 人間オーナーへのエスカレーションは `docs/human-todo.md` に記載する。

---

## 2. リリースチェックリスト（development → main）

`development → main` マージを実施する前に、以下を順番に確認します。
完了したら `[x]` にし、実施日時を隣に記録してください。

### 2-A. 事前確認

```
[ ] CI green（GitHub Actions の development ブランチが全ステップ成功）
[ ] ローカル lint・ビルド確認
      npm run lint
      npm run build
[ ] 本番スモークテスト
      npm run smoke:prod
[ ] human-todo.md の未完了 P1 項目がないこと
      （特に: Secrets 確認・実メール Cognito テスト・相談窓口の電話番号確認）
[ ] Service Worker VERSION が自動スタンプされていることを確認（`npm run build` の postbuild で out/sw.js に git SHA + 日付が注入される。手動変更は不要）
[ ] 掲載している外部情報が最新であること
      - 「認知症の人と家族の会」0120-294-456（公式サイトで要確認）
      - 「よりそいホットライン」0120-279-338（公式サイトで要確認）
[ ] プライバシーページの連絡先が決定・掲載されていること
```

### 2-B. 実施

```
[ ] development → main の PR を作成
[ ] 差分（コミット一覧・ファイル差分）を人間オーナーが目視確認
[ ] 人間オーナーが PR をマージ（main への push で本番デプロイが自動起動）
```

### 2-C. 事後確認

```
[ ] 本番 URL が正常に表示されること
      https://veai.jp/carequest/
[ ] Service Worker が activated になっていること
      DevTools → Application → Service Workers → Status: activated
[ ] CloudFront invalidation が /carequest/* で完了していること
      （GitHub Actions の invalidation ステップが成功）
[ ] 本番スモークテスト（再実行）
      npm run smoke:prod
[ ] 問題なければ human-todo.md のリリース判断項目を [x] にしてコミット
```

---

## 3. ロールバック方針

本番で問題が発生し、前の状態に戻す必要がある場合:

1. **main に revert コミットを作成**（force push ではなく `git revert` を使う）
   - GitHub 上で「Revert」ボタンを使うか、ローカルで `git revert <merge-commit-SHA>` してから PR を作成
2. **revert コミット後に本番ビルドが走ることを確認**
   - `npm run build` の postbuild で out/sw.js に新しい VERSION（git SHA + 日付）が自動スタンプされるため、ロールバック後のデプロイでも旧キャッシュは確実に破棄される。手動変更は不要
3. **CI → main 自動デプロイを待つ**（`docs/deploy.md` の手順どおり）
4. **`npm run smoke:prod` で正常を確認**
5. **事後 Issue 化**: 障害原因・恒久対策を GitHub Issue に記録し、次バッチで対応する（ITIL「問題管理」）

> 緊急度が高い場合は先に `docs/runbook.md` を参照してください。

---

## 4. 参照ドキュメント

| 目的 | ドキュメント |
|---|---|
| デプロイ手順・AWS 構成・IAM・CloudFront | `docs/deploy.md` |
| 人間がやること・承認ポイント | `docs/human-todo.md` |
| 本番障害の検知・対応手順 | `docs/runbook.md`（T14 で別途作成） |
| タスク管理・ITIL/PMP 方針 | `docs/project-management.md` |
| 役割分担（プランナー/ワーカー/人間） | `.claude/skills/carequest-delegate/SKILL.md` |
