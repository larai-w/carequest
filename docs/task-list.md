# Care Quest タスクリスト

Last updated: 2026-07-10 JST

## 第4バッチ(2026-07-10 立案)【テーマ: 堅牢性】— T17〜T20・T22 完了、T21 は第5バッチへ繰越

完了: T17 UTC日付バグ修正 `64471e0` / T18 Vitest+CI(52→59テスト) `075f040` / T19 ストレージ検証・移行 `81e9bcf` / T20 エラーバウンダリ `8e854b6` / T22 JSON インポート(70テスト、Opus 単独セッションで実施) `0b65db6`

## 第5バッチ(2026-07-10 立案)— **全6タスク完了**

完了: T23 `95cfb76` / T24 `9efaa81` / T25 `128a769` / T26 `d8a8f6c` / T21 `186b4aa`

方針: 堅牢性の仕上げ(T21・T24)+ Phase 1(実ユーザー定着検証)を迎える準備(T23・T25・T26)。PM レンズ: R-02/R-06/R-07 の軽減と、品質(アクセシビリティ)。

### 実行方法(Fable 不要)

Sonnet または Opus をメインモデルにしたセッションで:

> docs/task-list.md の T◯◯ を、受け入れ条件どおりに実装してください。まず AGENTS.md と .claude/skills/ の carequest-dev、carequest-product-tone を読んでから着手。1タスク1コミットで、完了後に npm test / lint / build の結果を報告。

依存関係: T23 と T25 はどちらもホーム画面を触るため**同時に別セッションで走らせない**(順番に)。他は独立。

### T23. つらいときの相談窓口へのやさしい導線(US-502)| P1 | おすすめ度 ★★★ | 推奨モデル: Opus

- 背景: エネルギーレベル「low」が続く介護者に、励ましだけで終わらず相談窓口をそっと示す(リスク登録簿 R-06 の軽減策。Phase 1 の安全要件)
- [ ] エネルギーレベルの日別履歴を保存できるようにする(スキーマ v3 + migration 追加 + storage テスト更新。T19 の migration チェーンに1関数足す形)
- [ ] 直近3日以上連続で low の場合のみ、ホームに穏やかなカードを表示: 「がんばりすぎていませんか。話を聞いてくれる場所があります」の趣旨 + About の相談窓口へのリンク
- [ ] 表示は数日に1回まで(最終表示日を保存)。閉じられる。赤・警告色にしない
- [ ] 押し付けない文言(トーンガイド・design-principles.md 必読)。「相談すべき」ではなく「here if you need」の姿勢
- [ ] ユニットテスト: 連続 low 判定ロジック(純関数化)、migration v2→v3
- [ ] npm test / lint / build green
- ★★★の理由: 「励ましだけで終わらせない」はこのプロダクトの安全上の約束(R-06)。Opus 推奨: スキーマ移行+安全機能の文言という、ミスが許されない組み合わせ

### T24. Service Worker VERSION の自動化 | P2 | おすすめ度 ★★ | 推奨モデル: Sonnet

- 背景: 現在はリリースごとに手動で `public/sw.js` の VERSION を上げるルール(R-07)。人間の手順ミスを仕組みで排除する
- [ ] デプロイ時に VERSION を自動注入する仕組み(例: `scripts/` にスクリプトを追加し、git short SHA かタイムスタンプで `public/sw.js` のプレースホルダを置換。`.github/workflows/deploy-prod.yml` に組み込む)
- [ ] ローカルの `npm run build` では従来どおり動く(注入は deploy 時のみ、または build 前スクリプトで常に)
- [ ] `docs/release-checklist.md` と `.claude/skills/carequest-dev/SKILL.md` の「手動で VERSION を上げる」記述を新しい仕組みに合わせて更新
- [ ] リスク登録簿 R-07 の状態を更新
- [ ] npm test / lint / build green
- ★★の理由: 小さいが「人間がミスできる箇所を減らす」= 固い仕組みの王道。影響範囲が明確で Sonnet 向き

### T25. 初回オンボーディングとデータ保存の説明 | P1 | おすすめ度 ★★★ | 推奨モデル: Sonnet

- 背景: 記録が端末内に保存されることを最初に伝えないと、消えたときの信頼喪失が大きい(R-02 のユーザー向け軽減)。Phase 1 で新規ユーザーを迎える前提条件
- [ ] 初回訪問時のみ、ホームに歓迎カードを表示: アプリの趣旨(今日を認める。頑張らせない)/ 記録は端末に保存されアカウント不要 / 大切な記録はふりかえり画面からいつでも書き出せる、の3点を短く
- [ ] 「はじめる」で閉じ、表示済みフラグを保存(既存の saveCareState 経由。スキーマ変更が必要なら T23 と同様に migration + テスト)
- [ ] 3画面以上の長いチュートリアルにしない(10秒ルール)。スキップ可能というより、そもそも1カードで完結
- [ ] 文言はトーンガイド準拠(義務・警告の言い回しにしない)
- [ ] npm test / lint / build green
- ★★★の理由: Phase 1 の定着検証は第一印象で決まる。データ消失の期待値調整は信頼の土台(プライバシーポリシーの姿勢とも一貫)

### T26. アクセシビリティの基礎改善 | P2 | おすすめ度 ★★ | 推奨モデル: Sonnet

- 背景: 一次ターゲットは40〜60代、高齢の介護者も想定(strategy.md)。基礎的な a11y はこの層への品質そのもの
- [ ] 監査して修正: アイコンのみボタン(カスタムタスク削除の × 等)の aria-label / フォーム要素の label 対応 / フォーカス可視化(focus-visible)/ タップ領域 44px 以上 / amber 系テキストのコントラスト確認(必要なら一段濃く)
- [ ] 見た目のデザイン(stone/amber カード)は維持。色を変える場合はトーンを崩さない範囲で
- [ ] 修正一覧をレポートに(何を・なぜ)
- [ ] npm test / lint / build green
- ★★の理由: 実ユーザーテスト前に潰しておくと手戻りが少ない。機械的に検出→修正できる範囲が多く Sonnet 向き

### T21. E2E スモークテスト(Playwright)| P2 | おすすめ度 ★★ | 推奨モデル: Sonnet【第4バッチから繰越】

- [ ] @playwright/test を devDependency に追加し、主要3フロー: ①クエストで記録→リロード→残っている ②休息モードのオン/オフ(ホーム) ③エクスポートのダウンロード(download イベント検証)
- [ ] next dev をローカル起動して実行(playwright.config の webServer 設定、basePath /carequest に注意)
- [ ] `.github/workflows/ci.yml` に E2E ジョブを追加(まず PR 時のみで可)
- [ ] npm test / lint / build green(E2E は別コマンド `npm run test:e2e`)
- ★★の理由: ユニットテストでは拾えない画面間の回帰を検知。導入・維持コストが T18 より高いため一段下

### 実行結果メモ(T17〜T20、2026-07-10)

- T17: 検証は TZ=Asia/Tokyo での node スクリプトで実施(JST 深夜1時→当日)。DST 境界も米東部で確認。過去の date 文字列は移行せず、境界シフトは一過性
- T18: vitest は node 環境+window ガード活用で jsdom 不要。CI は lint→test→build の順
- T19: localStorage のキー名は `carequest-state-v1` のまま(キー≠スキーマ版)。壊れたフィールドだけ置換・logs は要素単位で救済。救済発生時はホームで一度だけ穏やかに通知
- T20: Next.js 16 では error.tsx の `reset` prop が `unstable_retry` に変更されている(ワーカーが docs で発見)。global-error はインライン CSS(globals.css が使えない前提)

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
