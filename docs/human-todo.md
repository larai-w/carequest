# 人間(オーナー)がやること

Last updated: 2026-07-12 JST

AI エージェントでは代行できない、あなたにしかできない作業のノートです。上から順に片づけるのがおすすめです。完了したら `[x]` にしてコミットしてください。

## 今すぐ(GitHub プロジェクト立ち上げ)

- [x] **GitHub CLI の認証**(5分)
  - `gh` は `~/bin/gh` にインストール済み(v2.86.0)。PATH に追加: `echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`
  - Claude Code のプロンプトで `! gh auth login` → ブラウザ認証
  - つづけて `! gh auth refresh -s project`(Projects 操作に必要なスコープ)
- [x] **プロジェクト・Issue の一括作成**(1分)
  - `! bash scripts/github-project-bootstrap.sh`
  - 「Care Quest MVP」プロジェクト、ラベル、既存6 Issue + 新タスク5 Issue が作成され、プロジェクトに追加されます
  - 別ユーザー/別リポジトリで使う場合: `GITHUB_OWNER=<owner> GITHUB_REPO=<owner>/<repo> bash scripts/github-project-bootstrap.sh`
- [x] **`synthetic-check` ラベルの作成**(1分・T34 の前提): 定期ヘルスチェックの自動 Issue 起票に必要。`gh label create synthetic-check --description "定期ヘルスチェックの自動起票" --color D93F0B`(または GitHub の Labels ページから)

## リリース前に必須(P1)

- [x] **GitHub Actions Secrets の確認**(10–20分): 値の一覧は `docs/project-management.md` の「Verify GitHub Actions production secrets」参照。**⚠️2026-07-12 判明・修正済み**: `S3_BUCKET` が誤って `veai-jp-carequest-prod`(CloudFront が配信しないバケット)を指しており、リリースが本番に反映されていなかった。`veai-jp-toc-web` に修正して再デプロイ済み。この項目は今後も「必ず `veai-jp-toc-web`」を確認基準にすること
- [ ] **実メールでの Cognito サインアップ・スモークテスト**(15–30分)【2026-07-12: サインアップUI(道B/T47)を実装済み。ホームの「アカウント」→「新規登録」タブから自己登録できるようになった】: 新規登録(自分のメール)→ 確認コード到着 → コード入力で確認 → サインイン → 記録1件 → リロードで壊れない。**T45/T10 の確認も兼ねる**: サインイン成功時に自動同期の文言が出ること・記録追加でバックアップされること・サインアウト後は同期文言が出ないこと
- [x] **相談窓口の電話番号の最新性確認**(10分): 2026-07-12確認済み(番号は正しい。認知症の人と家族の会は受付時間未記載だったため`lib/contacts.ts`に「土日祝日を除く毎日10時~15時・LINE通話可」を追記、両窓口の`lastVerified`を2026-07-12に更新)
- [x] **プライバシーページの連絡先の決定**(10分): 2026-07-12 完了。問い合わせ先を `care_q@veai.jp` に決定し、`app/about/page.tsx` に「運営元・お問い合わせ」セクションを追加(運営元: veai.jp)。`app/privacy/page.tsx` の「About ページ記載の運営元まで」が実体を持つようになった
- [x] **リリース判断**: 2026-07-12 完了。PR #13 で development → main をマージ(merge commit `ffdfa87`)、バッチ5〜10(T21〜T46)を本番公開。**当初のデプロイは誤バケットに出ていた**(上記 S3_BUCKET 参照)ため、シークレット修正後に再デプロイし本番反映を確認: `veai.jp/carequest/` 全ページ 200・`sw.js` VERSION `20260712-ffdfa87`(= リリース SHA)・ライブ内容に PWA manifest/apple-touch-icon を確認。認証込みバックエンドスモークも green(実 Cognito トークンで GET/POST/GET・クロステナント防御を実証)

## プロダクト判断(AI がブロックされているもの)

- [x] **design-sync.md を読んで同期方針を決定する**(10–15分): 2026-07-12 完了。D-1〜D-6 をすべて選択肢 A(★★★)で承認。Issue #5 にコメントで記録済み。
- [x] **ローカルファースト方針の最終確定**(5分): 2026-07-12 完了。local-first(D-1 選択肢 A)を承認し Issue #5 に記録 → T10 の Phase A 着手ブロック解除。

## T14 監視のデプロイ(コードは準備済み・2026-07-10)

- [x] **アラート通知付きでデプロイ**: 2026-07-12 完了。`npx cdk deploy -c alertEmail=irevail8@gmail.com` を実行し 29 リソース反映。SNS トピック(`CareQuestAlerts`)・Lambda エラー/API 5xx アラーム・月額 $10 Budget を作成
- [ ] **【要対応・あなたの受信箱】** `irevail8@gmail.com` に届く AWS からの確認メールで「Confirm subscription」をクリック(しないとアラート・Budget 通知が届かない)。SNS と Budgets で別々に届く可能性あり、両方クリック
- [x] `npm run smoke:backend` で green を確認: 2026-07-12 `{"status":"ok"}`

## T6 デプロイ(コードは準備済み・2026-07-09)

- [x] **CDK 差分確認 → deploy**: 2026-07-12 完了(T14/T27/T29 と同一スタックのため 1 回の deploy で同時適用)
  - RemovalPolicy 変更はダウンタイムなしで反映(Cognito UserPool・DynamoDB テーブルが Retain に)
  - CORS が `https://veai.jp` + `http://localhost:3000` に絞られたことを実機確認済み(不正オリジンは弾かれ、veai.jp/localhost のみ許可)
  - **ロググループ競合は実在した** → 既存 `/aws/lambda/CareQuestStack-CareQuestApiHandler8D8954D7-elig7F9qd2l1` を削除してから deploy し、CDK 管理のロググループ(3ヶ月保持)を新規作成
  - deploy 後 `npm run smoke:backend` green 確認済み

## T27 + T29 デプロイ(セキュリティ修正・スロットリング・PITR・コードは準備済み・2026-07-11)

- [x] **Lambda のセキュリティ修正 + API Gateway スロットリング + DynamoDB PITR をまとめてデプロイ**: 2026-07-12 完了(T6/T14 と同時に deploy)
  - T27 修正内容: クロステナント書き込み脆弱性(ボディの pk でパーティション指定が可能だった)+ ID トークンの CloudWatch Logs 平文出力 → 本番反映済み
  - T29 追加内容: API Gateway ステージにスロットリング(10 rps / バースト 20)設定 + DynamoDB PITR 有効化 → 本番反映済み
  - デプロイ後 `npm run smoke:backend` green 確認済み

## 次回リリース時の確認(Service Worker)

- SW の `VERSION` は T24 で自動化済み(`npm run build` の postbuild が out/sw.js に git SHA + 日付を自動スタンプ)。**手動で上げる必要はなくなりました**
- [x] `https://veai.jp/carequest/sw.js` が 200(2026-07-12 確認・VERSION `20260712-ffdfa87`)
- [ ] **【ブラウザ実機・あなた】** DevTools → Application → Service Workers で activated / オフラインにしてリロードしてもアプリシェルが表示される

## 運用メモ

- **リポジトリの場所**: `~/Developer/carequest`(2026-07-12 に `~/Documents` から移動)。Documents は iCloud 同期対象で、複数 Mac で作業すると衝突コピー・`.git` 破損・node_modules 暴走のリスクがあるため、iCloud 対象外へ移した。
- **Mac 間の同期は git で行う**(iCloud ではない): 作業前 `git pull` → 作業後 `git commit && git push`。別 Mac では初回 `git clone https://github.com/larai-w/carequest.git`。Claude Code も新しいパスから起動すること。
- タスクの実装は「Fable が立案 → carequest-worker(Sonnet/Opus)が実装」の体制です。使い方は `.claude/skills/carequest-delegate/SKILL.md` 参照。Claude Code で「次のタスクを進めて」と言えば、この体制で自動的に進みます
- 次のおすすめタスクは `docs/task-list.md` の最新バッチを参照
