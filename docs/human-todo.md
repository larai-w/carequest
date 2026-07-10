# 人間(オーナー)がやること

Last updated: 2026-07-09 JST

AI エージェントでは代行できない、あなたにしかできない作業のノートです。上から順に片づけるのがおすすめです。完了したら `[x]` にしてコミットしてください。

## 今すぐ(GitHub プロジェクト立ち上げ)

- [ ] **GitHub CLI の認証**(5分)
  - `gh` は `~/bin/gh` にインストール済み(v2.86.0)。PATH に追加: `echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`
  - Claude Code のプロンプトで `! gh auth login` → ブラウザ認証
  - つづけて `! gh auth refresh -s project`(Projects 操作に必要なスコープ)
- [ ] **プロジェクト・Issue の一括作成**(1分)
  - `! bash scripts/github-project-bootstrap.sh`
  - 「Care Quest MVP」プロジェクト、ラベル、既存6 Issue + 新タスク5 Issue が作成され、プロジェクトに追加されます
  - 別ユーザー/別リポジトリで使う場合: `GITHUB_OWNER=<owner> GITHUB_REPO=<owner>/<repo> bash scripts/github-project-bootstrap.sh`
- [ ] **`synthetic-check` ラベルの作成**(1分・T34 の前提): 定期ヘルスチェックの自動 Issue 起票に必要。`gh label create synthetic-check --description "定期ヘルスチェックの自動起票" --color D93F0B`(または GitHub の Labels ページから)

## リリース前に必須(P1)

- [ ] **GitHub Actions Secrets の確認**(10–20分): 値の一覧は `docs/project-management.md` の「Verify GitHub Actions production secrets」参照
- [ ] **実メールでの Cognito サインアップ・スモークテスト**(15–30分): 登録メール到着 → 確認 → サインイン → 記録1件 → リロードで壊れない
- [ ] **相談窓口の電話番号の最新性確認**(10分): About に掲載した「認知症の人と家族の会 0120-294-456」「よりそいホットライン 0120-279-338」を公式サイトで確認
- [ ] **プライバシーページの連絡先の決定**(10分): `app/privacy/page.tsx` は「About ページ記載の運営元まで」としているが、About に連絡先がまだない。問い合わせ先(メールアドレス等)を決めて About に載せる
- [ ] **リリース判断**: CI green + 上記完了を確認して development → main をマージ(main への push で本番デプロイが走る)

## プロダクト判断(AI がブロックされているもの)

- [ ] **design-sync.md を読んで同期方針を決定する**(10–15分): `docs/design-sync.md` 末尾の「決定シート」(D-1〜D-6)を確認。**D-1(ローカルファーストで進めるか)を承認すれば T10 のブロックが外れます**(D-2〜D-6 は Phase A 実装をブロックしません)。決定は下の Issue コメントに記録。推奨はいずれも ★★★ の選択肢。
- [ ] **ローカルファースト方針の最終確定**(5分): 推奨は local-first(design-sync.md D-1 の選択肢 A / ★★★)。決定を Issue「Decide local-first vs AWS-first saving」にコメントで記録 → T10(AWS 同期)の着手条件が外れる

## T14 監視のデプロイ(コードは準備済み・2026-07-10)

- [ ] **アラート通知付きでデプロイ**(T6 の差分と一緒にデプロイ可): `cd infra && npx cdk diff` → `npx cdk deploy -c alertEmail=あなたのメールアドレス`
- [ ] デプロイ直後に届く AWS からの確認メールで「Confirm subscription」をクリック(しないとアラートが届かない)
- [ ] `npm run smoke:backend` で green を確認

## T6 デプロイ(コードは準備済み・2026-07-09)

- [ ] **CDK 差分確認 → deploy**(15–30分): `cd infra && npx cdk diff` を見てから `npx cdk deploy`
  - RemovalPolicy 変更はダウンタイムなし
  - CORS が `https://veai.jp` + `http://localhost:3000` に絞られる。他オリジンのテストツールは以後ブロックされる
  - **注意**: ロググループ `/aws/lambda/CareQuestStack-...` が既に存在すると作成エラーになる可能性。`aws logs describe-log-groups --log-group-name-prefix /aws/lambda/CareQuestStack` で事前確認し、あれば手動削除してから deploy
  - deploy 後 `npm run smoke:backend` で green を確認

## T27 デプロイ(セキュリティ修正・コードは準備済み・2026-07-11)

- [ ] **Lambda のセキュリティ修正をデプロイ**(T29 のスロットリング変更とまとめて1回で可): `cd infra && npx cdk diff` → `npx cdk deploy`
  - 修正内容: クロステナント書き込み脆弱性(ボディの pk でパーティション指定が可能だった)+ ID トークンの CloudWatch Logs 平文出力
  - デプロイまで本番の脆弱性は残ったままなので、**T6/T14 のデプロイと同時に早めの実施を推奨**
  - デプロイ後 `npm run smoke:backend` で green を確認

## 次回リリース時の確認(Service Worker)

- SW の `VERSION` は T24 で自動化済み(`npm run build` の postbuild が out/sw.js に git SHA + 日付を自動スタンプ)。**手動で上げる必要はなくなりました**
- [ ] デプロイ後の確認: `https://veai.jp/carequest/sw.js` が 200 / DevTools → Application → Service Workers で activated / オフラインにしてリロードしてもアプリシェルが表示される

## 運用メモ

- タスクの実装は「Fable が立案 → carequest-worker(Sonnet/Opus)が実装」の体制です。使い方は `.claude/skills/carequest-delegate/SKILL.md` 参照。Claude Code で「次のタスクを進めて」と言えば、この体制で自動的に進みます
- 次のおすすめタスク5つは `docs/task-list.md` の 2026-07-09 セクション参照
