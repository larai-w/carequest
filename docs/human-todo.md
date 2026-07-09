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

## リリース前に必須(P1)

- [ ] **GitHub Actions Secrets の確認**(10–20分): 値の一覧は `docs/project-management.md` の「Verify GitHub Actions production secrets」参照
- [ ] **実メールでの Cognito サインアップ・スモークテスト**(15–30分): 登録メール到着 → 確認 → サインイン → 記録1件 → リロードで壊れない
- [ ] **相談窓口の電話番号の最新性確認**(10分): About に掲載した「認知症の人と家族の会 0120-294-456」「よりそいホットライン 0120-279-338」を公式サイトで確認
- [ ] **プライバシーページの連絡先の決定**(10分): `app/privacy/page.tsx` は「About ページ記載の運営元まで」としているが、About に連絡先がまだない。問い合わせ先(メールアドレス等)を決めて About に載せる
- [ ] **リリース判断**: CI green + 上記完了を確認して development → main をマージ(main への push で本番デプロイが走る)

## プロダクト判断(AI がブロックされているもの)

- [ ] **ローカルファースト方針の最終確定**(5分): 推奨は local-first。決定を Issue「Decide local-first vs AWS-first saving」にコメントで記録 → T10(AWS 同期)の着手条件が外れる
- [ ] **T6(インフラハードニング)のデプロイ承認**: ワーカーが CDK 変更を用意したら、synth 差分を見て `cdk deploy` を実行(AWS への書き込みは人間のみ)

## 運用メモ

- タスクの実装は「Fable が立案 → carequest-worker(Sonnet/Opus)が実装」の体制です。使い方は `.claude/skills/carequest-delegate/SKILL.md` 参照。Claude Code で「次のタスクを進めて」と言えば、この体制で自動的に進みます
- 次のおすすめタスク5つは `docs/task-list.md` の 2026-07-09 セクション参照
