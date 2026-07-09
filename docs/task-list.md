# Care Quest タスクリスト

Last updated: 2026-07-10 JST

## 第3バッチ(2026-07-10)— **全5タスク完了**(T14 のデプロイのみ人間待ち)

実行体制: Fable(プランナー)+ Sonnet ワーカー×5(2波に分けて並列実行)。全タスク DoD 充足、1タスク1コミット(T12 `fac4dca` / T14 `c9f2904` / T15 `048065b` / T13 `444734c` / T16 `95ce781`)。

実行結果メモ:
- T12: 「今日のまとめ」は lib/messages.ts の純関数 getTodaySummaryBody に(将来のテスト容易性)。カスタムタスク削除は logs を消さない設計を維持
- T14: 通知メールはハードコードせず `cdk deploy -c alertEmail=...` で注入する設計。**デプロイと SNS 購読確認は human-todo 参照**
- T15/T16: release-checklist.md(変更タイプ+承認マトリクス)、risk-register.md(9リスク)、DoD が project-management.md に揃い、ITIL/PMP 運用の土台が完成
- ワーカー提案(次バッチ候補): JSON インポート(復元)機能、sw.js VERSION の自動インクリメント、Budgets 100% 閾値の追加

### 元の計画(記録用)

方針: 機能追加(第1・2バッチ)で MVP は充実したため、このバッチは「実ユーザーを迎える運用品質」に軸足を移す。ITIL(変更・リリース・インシデント管理)と PMP(リスク・品質)の観点を明示的に取り込む(→ [project-management.md](project-management.md) の「ITIL / PMP の観点」)。

### T12. ふりかえり「今日のまとめ」の実データ化 + カスタムタスク削除 | P1

- [ ] `app/reflection/page.tsx` の「今日のまとめ」が固定文言(「薬のサポート、食事の準備、声かけができました」)のまま。実際の記録から生成する(記録0件の日は責めない文言)
- [ ] カスタムタスクの削除手段(T8 ワーカー提案のフォローアップ)。誤追加を静かに消せる
- 委任: worker(**sonnet**)/ 観点: **品質(PMP)** — 表示と実データの乖離はユーザーの信頼を毀損する欠陥
- 見積り: 2〜3h

### T13. 記録のエクスポート(US-503 前半)| P1

- [ ] ふりかえり画面から自分の全記録を JSON でダウンロードできる(端末内データのみ。アカウント削除はバックエンド要のため後半に分割)
- 委任: worker(**sonnet**)/ 観点: **プライバシーポリシーの約束の履行**。「自分のデータを持ち出せる」は信頼の土台
- 見積り: 2h

### T14. 監視・アラートの整備 | P1

- [ ] CloudWatch アラーム: Lambda エラー、API 5xx(CDK 追加)
- [ ] AWS Budgets の月額アラート(Bedrock 導入前の防波堤。閾値例: 月1,000円)
- [ ] 簡易ランブック `docs/runbook.md`(アラートが鳴ったら何を見るか・smoke コマンド・ロールバック手順)
- 委任: worker(**sonnet**、CDK+docs)。**deploy は人間** / 観点: **ITIL インシデント管理・キャパシティ管理** — 検知手段ゼロのまま実ユーザーを迎えない
- 見積り: 3〜4h

### T15. リリース・変更管理の整備 | P2

- [ ] `docs/release-checklist.md`: development→main の手順書(CI green → smoke:prod → sw.js VERSION 上げ → マージ → invalidation 確認 → デプロイ後検証)
- [ ] 変更タイプの定義: 標準変更(文言・タスクデータ等、ワーカー+プランナーで完結)/ 通常変更(機能・インフラ、人間承認)/ 緊急変更(本番障害時の手順)
- 委任: worker(**sonnet**、docs)/ 観点: **ITIL 変更有効化・リリース管理** — 「何を人間が承認するか」を暗黙知から手順書へ
- 見積り: 2h

### T16. リスク登録簿と完成の定義(DoD)| P2

- [ ] `docs/risk-register.md`: リスクの特定・影響度・発生確率・対応策・オーナー(初期候補: 個人情報漏えい、localStorage 消失によるデータ喪失、相談窓口情報の陳腐化、単独運営のバス係数、AWS コスト逸脱、励まし文言が有害に働くケース)
- [ ] DoD の明文化(project-management.md へ): lint/build green・トーンガイド準拠・docs 更新・人間作業の human-todo 記録、を「Done」の条件にする
- 委任: worker(**sonnet**、docs。リスクの初期リストはプランナーが上記のとおり特定済み)/ 観点: **PMP リスク・品質マネジメント**
- 見積り: 2〜3h

実行順の推奨: T12(ユーザー影響のある欠陥修正)→ T14(検知手段)→ T13 → T15 → T16。「進めて」の指示で第2バッチと同じ体制(Fable オーケストレーション+ワーカー実装)で実行します。

- 第1バッチ(2026-07-08): **全5タスク完了**
- 第2バッチ(2026-07-09): 下記「次のおすすめ5タスク」。実装は carequest-worker(Sonnet/Opus)へ委任する運用(`.claude/skills/carequest-delegate/SKILL.md`)
- 人間の作業は [human-todo.md](human-todo.md) に分離

## 第2バッチ(2026-07-09)— T6〜T9 完了、T10 は人間待ち

実行体制: Fable(プランナー)がオーケストレーションし、Sonnet ワーカー(T6/T7/T8)と Opus ワーカー(T9)が実装。各タスクはプランナーが再検証して個別コミット。

### T6. AWS インフラのハードニング(US-501 残り)| P1 — **コード完了・デプロイ待ち**

- [x] Cognito / DynamoDB の RemovalPolicy を RETAIN に(commit `5c61550`)
- [x] CORS を `https://veai.jp` + `http://localhost:3000` に限定(`Vary: Origin` 付き)
- [x] Lambda ロググループの保持 90 日を明示
- [ ] **人間: synth 差分を確認して deploy**(注意点は human-todo.md。特に既存ロググループとの衝突)

### T7. 休息モードの UI(US-302)| P2 — **完了**

- [x] ホームに「今日は無理しない」→ おやすみモードの静かな画面(commit `4e463f2`)
- [x] 復帰時は「おかえりなさい」のみ。休んだ日数・ストリークは一切出さない
- [x] プランナー修正: クエスト画面が休息モード中にタスクを disabled にしていた既存挙動を撤廃(記録はブロックしない方針に統一)

### T8. カスタムタスクの追加(US-104)| P2 — **完了**

- [x] クエスト画面に1フィールド+追加ボタン。+10pt、やさしいデフォルト文言(commit `c01f315`)
- [x] localStorage 後方互換(customTasks が無い既存データでも壊れない)
- 次スプリント候補(ワーカー提案): カスタムタスクの削除手段、件数上限

### T9. Service Worker オフライン対応(US-301 残り)| P2 — **完了**

- [x] HTML は network-first、静的アセットは cache-first、バージョン付きキャッシュ(commit `24b46f3`)
- [x] 本番のみ登録(scope `/carequest/`)、非対応ブラウザで無害
- **運用ルール: デプロイのたびに `public/sw.js` の `VERSION` を上げる**

### T10. サインイン時のローカル→AWS 同期(US-103)| P1 — **着手ブロック中**

- [ ] サインイン時にローカル記録を重複なくマージ
- [ ] 失敗してもローカルに残り、穏やかなメッセージを表示
- 委任予定: worker(**opus**)
- **前提(人間)**: ローカルファースト方針の確定 + Cognito 実メールスモーク(human-todo.md 参照)。確定したら「T10 を進めて」で着手可能

### T11. セルフケア・効率化タスクの追加 — **完了(2026-07-09)**

- [x] `lib/tasks.ts` に「楽しい時間をすごした」「趣味の時間をつくった」「介護がラクになる工夫をした」(各+15pt)を追加
- 背景: オーナー方針「プレッシャーになる機構は避け、効率化・楽しみ・趣味をプラスにカウントする」→ 知見は [design-principles.md](design-principles.md)
- 実行: carequest-worker 体制(Sonnet)で初委任。lint / build green、プランナー再検証済み

## 第1バッチ(2026-07-08)— 完了

Status: **全5タスク完了**(2026-07-08、`npm run lint` / `npm run build` グリーン、`out/` 出力検証済み)

[strategy.md](strategy.md) のユーザーストーリーから「本番インフラに触れず、今すぐ完了・検証できるもの」を5つ選んで実行するリストです。GitHub Issues に転記する場合は `docs/project-management.md` のフィールド(Priority / Area / Owner / Estimate)を使ってください。

## タスク一覧

### 1. 遠距離介護タスクの追加(US-204)

- [ ] `lib/tasks.ts` に「電話やメッセージで話した」「手続き・調整をした」を追加
- 狙い: 遠距離介護者(ペルソナB: 田中さん)の「介護している感が薄い」罪悪感に応える
- Area: Frontend / Priority: P2 / Estimate: 0.5h

### 2. ふりかえりに「ここ7日間のあゆみ」を表示(US-202)

- [ ] `lib/stats.ts` に日別サマリーのヘルパーを追加
- [ ] `app/reflection/page.tsx` に過去7日の記録サマリーを表示
- 制約: 記録がない日を「0件」と表示しない(責めない)。記録がある日だけをやさしく並べる
- Area: Frontend / Priority: P1 / Estimate: 2h

### 3. プライバシーポリシーページの追加(US-501の一部)

- [ ] `app/privacy/page.tsx` を新規作成(何を保存し、何をしないかを平易に説明)
- [ ] About ページからリンク
- 狙い: 介護記録はプライバシーの塊。実データ収集前の信頼の土台
- Area: Frontend / Priority: P0 / Estimate: 1h

### 4. About に相談窓口セクションを追加(US-502の一部)

- [ ] 地域包括支援センター・家族会・よりそいホットラインへの導線を About に追加
- 制約: 押し付けにならない文言。「励ましだけで終わらせない」ための安全網
- Area: Frontend / Priority: P1 / Estimate: 1h

### 5. PWA マニフェストとアイコンの追加(US-301の第一歩)

- [ ] `app/manifest.ts` を追加(`basePath: /carequest` 配下で正しく動くこと)
- [ ] アプリアイコン(192 / 512 / apple-touch-icon)を生成して `public/` に配置
- [ ] ホーム画面追加時に「Care Quest」として立ち上がることをビルド出力で確認
- 備考: Service Worker(オフライン対応)は次のイテレーションに分割
- Area: Frontend / Priority: P1 / Estimate: 2h

## 完了条件(共通)

- `npm run lint` と `npm run build` が通る
- 静的エクスポート `out/` に成果物が正しく含まれる
- 文言が「責めない・競わせない・医療アドバイスをしない」トーンに沿っている

## 実行結果メモ(2026-07-08)

- タスク5の注意点: `output: "export"` では `app/manifest.ts` に `export const dynamic = "force-static"` が必須(ないとビルドが落ちる)
- `<link rel="manifest">` には basePath が自動付与されるが、`metadata.icons` の URL には付与されない。apple-touch-icon は `/carequest/apple-touch-icon.png` と明示した
- アイコンは SVG から `qlmanage -t` + `sips` で 512 / 192 / 180px の PNG を生成し `public/` に配置
- 相談窓口の連絡先(認知症の人と家族の会・よりそいホットライン)は掲載前に電話番号の最新性を人間が再確認すること

## 今回やらないこと(意図的な除外)

- AWS インフラのハードニング(US-501 残り): CDK 変更はデプロイ判断を人間が行うため別タスク
- 記録の AWS 同期(US-103): プロダクト決定(local-first)の確定待ち
- Service Worker / プッシュ通知: 静的エクスポート + basePath での検証に時間がかかるため分割
