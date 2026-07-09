# Care Quest タスクリスト

Last updated: 2026-07-09 JST

- 第1バッチ(2026-07-08): **全5タスク完了**
- 第2バッチ(2026-07-09): 下記「次のおすすめ5タスク」。実装は carequest-worker(Sonnet/Opus)へ委任する運用(`.claude/skills/carequest-delegate/SKILL.md`)
- 人間の作業は [human-todo.md](human-todo.md) に分離

## 次のおすすめ5タスク(2026-07-09)

### T6. AWS インフラのハードニング(US-501 残り)| P1

- [ ] Cognito / DynamoDB の RemovalPolicy を本番安全(RETAIN)にする
- [ ] CORS を `https://veai.jp` に絞る
- [ ] Lambda のログ保持期間を明示する
- 委任: worker(**sonnet**)。`cd infra && npm run build && npm run synth` まで。**deploy は人間**
- 完了条件: synth が通り、人間が差分を確認して deploy

### T7. 休息モードの UI(US-302)| P2

- [ ] ホームから `restMode` を切り替えられる
- [ ] 休息モード中は記録を促さない、やさしい画面になる(ストリークは導入しない)
- 委任: worker(**sonnet**)
- 完了条件: lint / build green、トーンガイド準拠

### T8. カスタムタスクの追加(US-104)| P2

- [ ] リストにないケアをユーザーが追加できる(タイトルのみ、ポイント付与)
- [ ] localStorage に永続化され、クエスト画面に並ぶ
- 委任: worker(**sonnet**)
- 完了条件: lint / build green

### T9. Service Worker オフライン対応(US-301 残り)| P2

- [ ] `/carequest/` 配下でアプリシェルがオフライン動作する
- [ ] デプロイ後に古い HTML を配り続けない(キャッシュのバージョニング)
- 委任: worker(**opus**)— basePath + 静的エクスポートの難所のため
- 完了条件: lint / build green、`out/` 検証

### T10. サインイン時のローカル→AWS 同期(US-103)| P1

- [ ] サインイン時にローカル記録を重複なくマージ
- [ ] 失敗してもローカルに残り、穏やかなメッセージを表示
- 委任: worker(**opus**)
- **前提(人間)**: ローカルファースト方針の確定 + Cognito 実メールスモーク(human-todo.md 参照)
- 完了条件: lint / build / smoke:backend green

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
