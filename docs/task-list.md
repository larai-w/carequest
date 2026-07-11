# Care Quest タスクリスト

Last updated: 2026-07-11 JST

## 第7バッチ(2026-07-11 立案・同日完了)— **全3タスク完了**

完了: T35 `9439749` / T37 `bd2de20` / T36 `05b372e`

実行体制: Fable(プランナー)+ ワーカー4(Sonnet×3・Opus×1)。プランナーはコードを書かず、立案・委任・レビュー・コミットのみ。

### 実行結果メモ(2026-07-11)

- **T35**: syncCareLog の戻り値を SyncResult(skipped / ok)に変更。未サインインは「同期しないのが正常」なので文言ゼロ。失敗時文言は design-sync.md §4 と統一
- **T36**: Opus ワーカーが Next.js 16 の hydration ガイドを読んで mounted フラグ方式を実装 → プランナーレビューで React 19 の新 lint ルール(react-hooks/set-state-in-effect)違反を検出 → 修正ワーカー(Sonnet)が **useSyncExternalStore の canonical パターン**に書き換えて解消。E2E 出力から "Hydration failed" が消えたことを確認(修正前は毎回出力)
- **T37**: README 刷新 + docs 7ファイルの陳腐化修正。ワーカー報告の要判断事項: docs/active-todo.md(Codex 引き継ぎ文書)は全体が古く、全面改訂は別タスク推奨
- 教訓: ワーカーの「lint green」報告と実際の lint 結果が食い違うことがある(eslint キャッシュ or 最終編集後の再実行漏れ)。**プランナーによる再検証は省略しない**(delegate スキルの手順 4 のとおり)

方針(記録): 第6バッチでバックエンドが固まったため、実ユーザーを迎える前の品質欠陥と情報の陳腐化を潰す。全タスクが人間の決定に依存せず、Opus/Sonnet 単独セッションでもワーカー委任でも完結できる。PM レンズ: 品質(PMP)— 表示と実態の乖離はユーザーの信頼を毀損する。変更タイプ: すべて標準〜通常変更(インフラ変更なし・デプロイ不要、次回リリースに同乗)。

依存関係: **T35 と T36 はどちらも app/quest/page.tsx を触るため同時に走らせない**(T35 → T36 の順)。T37 は独立して並列可。

### T35. 未サインイン時の「同期失敗」表示をなくす | P1 | おすすめ度 ★★★ | 推奨モデル: Sonnet

- 背景: **本番の実欠陥**。クエストで記録するたびに `syncCareLog` が無条件に呼ばれ、未サインインユーザーには毎回「クラウド同期に失敗しました。オフラインか認証が必要かもしれません。」が表示される(401 → false)。localStorage への保存は成功しているのに失敗を報せるのは、ローカルファーストの約束(design-sync.md §1)と「責めない・焦らせない」トーンの両方に反する
- [ ] サインイン状態の判定ヘルパーを lib/api.ts に追加(fetchAuthSession のトークン有無で判定。例外時は「未サインイン」扱い)
- [ ] 未サインイン時: syncCareLog を呼ばず、同期ステータス文言を一切表示しない(端末保存のみで完結するのが正常状態)
- [ ] サインイン済みで同期失敗時: 穏やかな文言を維持しつつ「記録はこの端末にちゃんと残っています」の趣旨を含める(design-sync.md §4 の文言方針と整合)
- [ ] エッジケース: セッション切れ(トークン期限切れ)でも失敗表示が焦らせないこと/オフライン時も同様
- [ ] ユニットテスト: 判定ロジックが例外時に安全側(未サインイン)へ倒れること。amplify のモックが重い場合は判定を純関数化してテスト
- [ ] npm test / lint / build green
- ★★★の理由: 全未サインインユーザーが毎記録で目にする欠陥。修正範囲が明確(lib/api.ts + app/quest/page.tsx)で Sonnet 向き

### T36. hydration mismatch の解消 | P2 | おすすめ度 ★★ | 推奨モデル: Opus【T35 完了後】

- 背景: 全ページが useState 初期化で localStorage を読むため、プリレンダー HTML とクライアント初回描画が不一致になり hydration error が発生(dev で顕在。React がツリー再生成で回復するため実害は軽微だが、初回描画のやり直しコストと将来の不具合温床)。第6バッチの E2E 実行時にも毎回観測された
- [ ] AGENTS.md ルールに従い node_modules/next/dist/docs/ の該当ガイドを読み、Next.js 16 推奨の解消パターンを選ぶ(mounted フラグ / useSyncExternalStore 等)。全ページで同じパターンに統一(共通フック化を推奨)
- [ ] 対象: app/page.tsx・app/quest/page.tsx・app/reflection/page.tsx(community/about も localStorage を読むなら対象)
- [ ] マウント前の表示はレイアウトシフト・ちらつきを最小に(既存カードの骨組みを出す等。真っ白な画面を長く見せない)
- [ ] next dev でホーム・クエスト・ふりかえりを開き、コンソールに hydration エラーが出ないことを確認
- [ ] 挙動不変の確認: E2E 全7フローがパス(npm run test:e2e)+ npm test / lint / build green
- ★★の理由: 実害は軽微だが「穴のない固い仕組み」の仕上げ。描画整合はミスると全画面に波及するため Opus 推奨

### T37. ドキュメントの棚卸し(README + 陳腐化した相互参照)| P2 | おすすめ度 ★★ | 推奨モデル: Sonnet

- 背景: 6バッチ分の変化に文書が追いついていない箇所がある(例: release-checklist.md の「runbook.md(T14 で別途作成)」は既に作成済み、human-todo の運用メモが「2026-07-09 セクション参照」のまま、README がプロジェクトの実体を説明していない)。R-04(バス係数)の軽減はドキュメントが現実と一致していてこそ
- [ ] README.md を刷新: プロダクト概要(1段落・トーン準拠)/ ローカル開発(dev・test・test:e2e・build)/ アーキテクチャ概要(静的エクスポート + S3/CloudFront、AWS バックエンドは任意サインイン)/ docs/ への案内(どの文書を最初に読むか)
- [ ] docs/ 内の陳腐化した記述を現状に合わせて修正(全 .md を読み、完了済みタスクへの「予定」記述・存在するファイルへの「別途作成」記述・古いセクション参照を更新)
- [ ] **事実の変更・方針の変更はしない**(状況の記述を現状に合わせるのみ)。判断が必要な不整合を見つけたら、変更せず最終レポートで報告
- [ ] 変更対象は README.md と docs/ のみ。コード・スキル・エージェント定義は触らない
- [ ] npm run lint green(念のため)
- ★★の理由: 単独運営の継続性(R-04)と新規参加者の立ち上がりに直結。機械的に照合できる作業で Sonnet 向き

## 第6バッチ(2026-07-10 立案・2026-07-11 完了)— **全8タスク完了**(T27+T29 のデプロイのみ人間待ち)

## 第4バッチ(2026-07-10 立案)【テーマ: 堅牢性】— T17〜T20・T22 完了、T21 は第5バッチへ繰越

完了: T17 UTC日付バグ修正 `64471e0` / T18 Vitest+CI(52→59テスト) `075f040` / T19 ストレージ検証・移行 `81e9bcf` / T20 エラーバウンダリ `8e854b6` / T22 JSON インポート(70テスト、Opus 単独セッションで実施) `0b65db6`

## 第6バッチ(2026-07-10 立案・2026-07-11 完了)— **全8タスク完了**(T27+T29 のデプロイのみ人間待ち)

完了: T27 `a634bdb` / T30 `582b0c4` / T31 `7d972d6` / T34 `6c1ef9e` / T29 `b9eaf5b` / T33 `e74ae10` / T32 `d0c2107` / T28 `e8f5a0d`

実行体制: Fable(プランナー)+ ワーカー8(Opus×2: T27/T30、Sonnet×6)を3波で実行。各タスクはプランナーが再検証して個別コミット。

### 実行結果メモ(2026-07-11)

- **T27(セキュリティ)**: クロステナント書き込み(ボディの pk で他ユーザーのパーティションへ書けた)とトークンのログ出力を修正。**POST /entries はボディに id が必須**になった(sk = id の冪等 PUT)。フロント lib/api.ts は常に id を送っているため互換。旧レコード(sk=タイムスタンプ)は新レコードと共存(読み取りは pk クエリなので影響なし)。**デプロイまで本番の脆弱性は残る → human-todo の「T27+T29 デプロイ」を早めに**
- **T29**: ステージ名は `dev` のまま維持(URL 変更は Secrets 更新+ダウンタイムリスクがあり、独立タスクに切り出すのが安全)。PITR は非推奨でない `pointInTimeRecoverySpecification` で設定
- **T30**: docs/design-sync.md の決定シート **D-1 を人間が承認すれば T10 のブロックが外れる**
- **T32**: ワーカーがセッション上限で中断 → プランナーが残り(lint 修正・検証)を引き取り完了。E2E は計7フロー
- **T33**: 残存 moderate 2件は next 内包の postcss 起因(ビルドツールでありエンドユーザー曝露なし・upstream 修正待ち。Dependabot が週次で追跡)
- **T28**: root vitest の exclude 上書きでデフォルト除外が消え infra/node_modules を拾う問題をプランナーが修正(exclude は明示的に全指定)
- 観察(次バッチ候補): dev モードで localStorage 依存の初期描画による hydration warning が出る(実害なし・静的エクスポートの本番では passive)。気になるなら useSyncExternalStore か mounted フラグで解消可能

### 実行方法(Fable 不要)

Sonnet または Opus をメインモデルにしたセッションで:

> docs/task-list.md の T◯◯ を、受け入れ条件どおりに実装してください。まず AGENTS.md と .claude/skills/ の carequest-dev、carequest-product-tone を読んでから着手。1タスク1コミットで、完了後に npm test / lint / build(infra を触ったら infra の build/synth も)の結果を報告。

依存関係と並列可否:
- **T27 → T28 の順**(テストは切り出されたハンドラが前提)
- **T27・T29 は両方 `infra/lib/carequest-stack.ts` を触るため同時に別セッションで走らせない**(順番に)
- T30(設計書)・T31(フロント)・T32(E2E)・T33・T34 は独立して並列可
- インフラ変更(T27・T29)は synth まで。**deploy は人間**(変更が溜まるので、T27+T29 完了後にまとめて 1 回のデプロイを推奨)

### T27. Lambda の切り出しとセキュリティ欠陥の修正 | P0 | おすすめ度 ★★★ | 推奨モデル: Opus

- 背景: プランナー点検で発見した2件の欠陥修正。**(a) POST /entries がボディの `...body` spread を pk/sk の後に置いているため、ボディに `pk` を入れると他ユーザーのパーティションへ書き込める**(クロステナント書き込み)。**(b) `console.log('Event:', ...)` がイベント全体(Authorization ヘッダーの ID トークン含む)を CloudWatch Logs に平文出力**している
- [ ] Lambda を `fromInline` から `infra/lambda/entries/index.js`(または .ts)へ切り出し、`Code.fromAsset` に変更(テスト可能にする)
- [ ] POST の入力検証: 許可フィールドのみ受け付けるホワイトリスト方式(id, taskId, title, points, completedAt, date, energyLevel)。**pk / sk / userId はサーバー側で必ず上書きし、ボディからは受け取らない**
- [ ] 型・サイズ検証: points は有限数値、date は YYYY-MM-DD、title は文字列長上限(例 200 文字)、ボディ全体サイズ上限(例 10KB)。不正は 400 を返す(500 にしない)
- [ ] イベント全体のログ出力を廃止し、必要最小限(httpMethod・resource・requestId)の構造化ログに置き換える。トークン・ヘッダーは絶対に出力しない
- [ ] sk を `log.id` ベースに変更し、同じ記録の再送で重複が生じないようにする(冪等な PUT。T30 の同期設計の土台)
- [ ] `cd infra && npm run build && npm run synth` green(deploy は人間)
- ★★★の理由: 認可バイパスに相当する実害のある欠陥。ミスが許されない修正のため Opus 必須。ITIL 上は欠陥修正だが、認可設計に触れるため**通常変更**として人間がデプロイ前に差分確認

### T28. Lambda ユニットテスト + CDK assertions テスト | P1 | おすすめ度 ★★★ | 推奨モデル: Sonnet【T27 完了後】

- 背景: R-10(回帰)。インフラとバックエンドにテストがなく、T27 の修正が正しいことを機械的に保証できない
- [ ] T27 で切り出したハンドラのユニットテスト: pk 上書き攻撃が防がれる/不正 points・date が 400/正常 POST・GET/OPTIONS プリフライト/未知ルート 404(DynamoDB クライアントはモック)
- [ ] CDK assertions テスト(`aws-cdk-lib/assertions`): RETAIN ポリシー・Cognito オーソライザ付きメソッド・アラーム2件・Budgets の存在を検証(スナップショットではなくファイングレインで)
- [ ] `.github/workflows/ci.yml` の infra ジョブにテストステップを追加
- [ ] npm test / lint / build + infra build/synth/test green
- ★★★の理由: セキュリティ修正(T27)は「二度と壊れない」仕組みとセットで完了(DoD)。テスト構造が明確で Sonnet 向き

### T29. API Gateway スロットリング + DynamoDB PITR | P1 | おすすめ度 ★★ | 推奨モデル: Sonnet【T27 と同時並行不可】

- 背景: R-05(コスト逸脱)・R-02(データ喪失)。現在レート制限なし = 盗まれたトークン1つで課金攻撃が可能。テーブルのバックアップもない
- [ ] API Gateway ステージにスロットリング設定(例: rateLimit 10 rps / burstLimit 20。個人アプリには十分)
- [ ] DynamoDB の Point-in-Time Recovery を有効化
- [ ] ステージ名 `dev` を `prod` へ変更するかを検討し、**変更する場合は** フロントの `NEXT_PUBLIC_API_URL`(GitHub Secrets)更新が必要な旨を human-todo.md に追記(判断に迷ったら現状維持で可。理由をコミットメッセージに)
- [ ] risk-register.md の R-05 を更新
- [ ] infra build/synth green(deploy は人間)
- ★★の理由: 発生確率は低いが、起きたときの実害(課金・データ喪失)が大きい防波堤。設定変更が中心で Sonnet 向き

### T30. ローカル→AWS 同期(T10)の設計書 | P1 | おすすめ度 ★★★ | 推奨モデル: Opus

- 背景: T10 は「ローカルファースト方針の人間決定待ち」でブロック中。**決定に必要な材料が揃っていないことがブロックの実態**なので、設計書を先に作って人間が Yes/No を判断できる状態にする
- [ ] `docs/design-sync.md` を新規作成: (1) ローカルファースト原則(localStorage が常に真、AWS はバックアップ)(2) 同期プロトコル: log.id を冪等キーにした差分 PUT(T27 の sk 変更が前提)(3) 競合解決: lib/import.ts のマージ方針(既存優先・ID 重複排除)を踏襲(4) 失敗時の挙動: ローカルに必ず残り、穏やかな文言で通知(5) 段階導入案: Phase A 手動バックアップボタン → Phase B サインイン時自動
- [ ] 人間が判断すべき決定点を明示した「決定シート」を末尾に(選択肢+おすすめ度+理由の形式)
- [ ] エッジケースを明記: 同一 log.id で内容が異なる場合/時計ずれ/オフライン長期間/複数端末同時書き込み
- [ ] コードは書かない(設計のみ)。human-todo.md に「design-sync.md を読んで決定」を追記
- ★★★の理由: Phase 1 の最重要機能(R-02 の恒久軽減)のクリティカルパス。分散データの整合性設計はミスが許されないため Opus

### T31. 保存失敗の可視化 + API レスポンスの sanitize | P2 | おすすめ度 ★★ | 推奨モデル: Sonnet

- 背景: `saveCareState` が失敗(容量超過・プライベートモード)を握りつぶしており、ユーザーは「記録できたつもり」になり得る。また `fetchCareEntries` がレスポンスを無検証で `CareLog[]` にキャストしている(生 JSON を信用しない原則の違反)
- [ ] `saveCareState` が成否を返すようにし、失敗時はホーム/クエストで穏やかに通知(「記録を保存できませんでした。端末の空き容量をご確認ください」の趣旨。責めない・焦らせない文言)
- [ ] `fetchCareEntries` のレスポンスを要素単位で検証(lib/storage.ts の sanitizeLog 相当を通す。不正要素は静かに除外)
- [ ] ユニットテスト: 保存失敗の検知、不正レスポンス要素の除外
- [ ] npm test / lint / build green
- ★★の理由: 「静かに失敗する」箇所を潰すのは固い仕組みの基本。既存パターン(sanitize・穏やかな通知)の適用で Sonnet 向き

### T32. E2E テストの拡充(第5バッチ機能)| P2 | おすすめ度 ★★ | 推奨モデル: Sonnet

- 背景: T21 の E2E は第5バッチ以前の3フローのみ。オンボーディング・インポート・相談窓口カードは回帰検知がない(R-10)
- [ ] オンボーディング: 初回訪問でカード表示 → 「はじめる」→ リロードで再表示されない(beforeEach の onboardingShown 注入をこのテストだけ外す)
- [ ] インポート: エクスポート済み JSON を `setInputFiles` で読み込み → 件数メッセージ表示 → 記録が増えている。壊れた JSON では穏やかなエラーメッセージ
- [ ] 相談窓口カード: localStorage に3日連続 low の energyHistory を注入 → ホームにカード表示 → 「とじる」で消える
- [ ] npm run test:e2e green(既存3テストも含め全パス)
- ★★の理由: 安全機能(相談窓口)の回帰は実害が大きい。localStorage 注入パターンは T21 で確立済みで Sonnet 向き

### T33. 依存関係の自動監視(Dependabot + npm audit)| P2 | おすすめ度 ★★ | 推奨モデル: Sonnet

- 背景: 依存パッケージの脆弱性を検知する仕組みがない(現に npm install 時に moderate 2件が放置されている)。サプライチェーンは R-01 の入口
- [ ] `.github/dependabot.yml`: npm(ルート+infra)と github-actions を週次でチェック、PR は少数にグループ化
- [ ] CI に `npm audit --audit-level=high` ステップを追加(high 以上で fail。moderate では落とさない: 個人開発で警報疲れを起こさない)
- [ ] 現在の audit 結果を確認し、修正可能なものは `npm audit fix`(breaking しない範囲)で解消
- [ ] npm test / lint / build green
- ★★の理由: 一度入れれば恒久的に効く「仕組みによる防御」。設定ファイル中心で Sonnet 向き

### T34. 本番の定期ヘルスチェック(合成監視)| P2 | おすすめ度 ★ | 推奨モデル: Sonnet

- 背景: 現在の監視(T14)はエラー発生時のみ反応する。サイトが「静かに落ちている」(CloudFront 設定ミス・証明書切れ等)は誰も気づけない
- [ ] `.github/workflows/synthetic-check.yml`: cron(例: 6時間ごと)で `npm run smoke:prod` を実行し、失敗時のみ GitHub Issue を自動起票(重複起票しない: 既存 open Issue があればスキップ)
- [ ] Issue の文言はランブックへのリンク付き(初動を迷わせない)
- [ ] 手動実行(workflow_dispatch)も可能に
- [ ] npm test / lint / build green
- ★の理由: あると安心だが、実ユーザーが少ない現段階では優先度は相対的に低い。ITIL 可用性管理の仕上げとして

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
