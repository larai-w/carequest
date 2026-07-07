# Care Quest タスクリスト(今できること5つ)

Last updated: 2026-07-08 JST
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
