# Care Quest active TODO(セッションの起点)

Last verified: 2026-07-12 JST

新しいセッションはこのファイルから読み始めてください。ここは「人間の作業・AI(プランナー/ワーカー)の作業」のハンドオフ地点です。詳細は各正典ドキュメントに委譲し、この 1 枚では**現在地と次の一手**だけを正確に保ちます。

## 正典ドキュメント(詳細はこちら)

- **人間がやること**: [human-todo.md](human-todo.md) — オーナー judgment・メール受信箱・リリース判断が要るもの
- **実装タスクの計画/履歴**: [task-list.md](task-list.md) — バッチごとの計画と完了記録
- **T10(ローカル→AWS 同期)の設計**: [design-sync.md](design-sync.md) — 承認済みの同期方針
- **運用/改善の記録**: [improvement-log.md](improvement-log.md) / [risk-register.md](risk-register.md) / [runbook.md](runbook.md)
- **委任の進め方**: `.claude/skills/carequest-delegate/SKILL.md`(「次のタスクを進めて」でプランナー→ワーカー体制が起動)

## 現在地(2026-07-12)

- ブランチ: `development`(CI green)。本番フロントは `https://veai.jp/carequest/` で配信中
- **バックエンドを本番デプロイ済み(2026-07-12)**: T6(CORS 限定)/ T14(監視・SNS/CloudWatch アラーム・$10 Budget)/ T27(クロステナント書き込み修正・IDトークン平文ログ除去)/ T29(APIスロットリング 10rps・DynamoDB PITR)。`npm run smoke:backend` green、CORS 3オリジン実機検証済み
- Cognito **テストユーザー作成済み**: `demo@example.com` / `CareQuest123!`(本番プール・CONFIRMED/Enabled。ブラウザスモーク用)
- 第1〜10バッチはすべて完了(履歴は task-list.md)

## 次の一手

### 人間(あなた)— 詳細は human-todo.md
1. SNS 購読の確認: `irevail8@gmail.com` に届く AWS メールで「Confirm subscription」(SNS・Budget 両方の可能性)
2. ブラウザ・スモークテスト: `demo@example.com` でサインイン → 記録 → リロード → 「バックアップが完了しました。」表示・サインアウト後は同期文言なし
3. リリース判断: CI green を確認して `development → main` マージ(本番フロントのデプロイが走る)
4. マージ後: `https://veai.jp/carequest/sw.js` が 200 / オフラインでアプリシェル表示

### AI(プランナー/ワーカー)
- **T10 Phase A(手動バックアップボタン)** — コード前提(T27 デプロイ済・T31 完了・local-first 承認)はすべて充足。残るゲートは上記②のブラウザスモークのみ。**「T10 を進めて」で opus ワーカーに委任して着手**
- それ以外の自己完結タスクは task-list.md の「次バッチ候補」を参照

## 参照: CDK 出力(本番)

- Cognito User Pool ID: `ap-northeast-1_INR8bI3WX`
- Cognito Client ID: `7ghfrdbrthuvi86if1orlktesn`
- API URL: `https://sx2rh60mtb.execute-api.ap-northeast-1.amazonaws.com/dev/`
- DynamoDB テーブル: `CareQuestStack-CareQuestEntriesTableDDEC3FF5-1AT7RUT3T6UQM`
- SNS アラートトピック: `arn:aws:sns:ap-northeast-1:339712703146:CareQuestAlerts`
- 本番 S3 バケット: `veai-jp-toc-web`(配下 `/carequest/`)/ CloudFront: `E32Z6UIZTZD6DE`
- AWS アカウント: `339712703146` / リージョン: `ap-northeast-1` / スタック: `CareQuestStack`

> CloudFront ディストリビューション `E32Z6UIZTZD6DE` は `veai.jp` の他パス(`/ready/*`・`/gutpacer/*`・`/api/*` 等)と**共有**。Free プランのビヘイビア上限のため `/carequest/*` 専用ビヘイビアは追加できず、既定オリジン `veai-jp-toc-web` + `veai-url-rewrite` 関数で配信している。**カジュアルに変更しないこと。**

## よく使うコマンド

```bash
# ローカル検証
npm run lint
npm run build
cd infra && npm run build && npm run synth

# スモークテスト
npm run smoke:backend   # /health が 200 {"status":"ok"}
npm run smoke:prod      # 本番 URL 群が 200

# 読み取り専用の AWS 状態
AWS_REGION=ap-northeast-1 S3_BUCKET=veai-jp-toc-web \
  CLOUDFRONT_DISTRIBUTION_ID=E32Z6UIZTZD6DE npm run aws:status

# インフラ更新(deploy はデプロイ判断のあるとき) / 本番デプロイは human-todo.md 参照
cd infra && npx cdk diff
cd infra && npx cdk deploy -c alertEmail=<通知先>
```

## セッション再開チェックリスト

1. このファイルを読む
2. `git status --short --branch`
3. `npm run lint`(必要に応じて `npm run build`。Turbopack がポート束縛エラーを出す制限サンドボックス外で実行)
4. `cd infra && npm run synth`
5. AWS 作業をするなら `npm run aws:status` を上の「参照」と突き合わせる
6. 最優先の未着手項目に着手(人間タスクは human-todo.md、実装は task-list.md)
7. 変更・検証・残作業をこのファイルと該当正典ドキュメントに反映する
