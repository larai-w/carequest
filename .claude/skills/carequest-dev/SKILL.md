---
name: carequest-dev
description: Care Quest のコードを書く・レビューする・ビルドする際の開発ワークフロー。Next.js 16 静的エクスポートの落とし穴、basePath 制約、必須チェック、AWS/CloudFront の運用制約を含む。
---

# Care Quest 開発スキル

## 着手前の必須手順

1. **Next.js 16 のドキュメントを必ず読む**: この repo の Next.js は学習データと異なる可能性がある(AGENTS.md ルール)。`node_modules/next/dist/docs/` の該当ガイドを読んでから app コードを書く
2. 既存コードのスタイルに合わせる: `rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm` 系のカードUI、stone/amber カラーパレット、日本語のやさしい文言

## 静的エクスポートの落とし穴(実地で確認済み)

- `next.config.ts` は `basePath: "/carequest"` + `output: "export"` + `trailingSlash: true`
- **metadata route(`app/manifest.ts` 等)には `export const dynamic = "force-static"` が必須**。ないとビルドが `Failed to collect page data` で落ちる
- `<link rel="manifest">` の href には basePath が自動付与されるが、**`metadata.icons` の URL には付与されない**。`public/` のアセットを metadata で参照するときは `/carequest/...` と明示する
- manifest の `start_url` / `scope` / icon `src` も `/carequest/` を明示する(Next は書き換えない)
- サーバー機能(Route Handlers の Request 依存、redirects、headers、Server Actions 等)は使えない

## 変更後の必須チェック

```bash
npm run lint
npm run build
# infra を触った場合:
cd infra && npm run build && npm run synth
```

ビルド後は `out/` の実出力を grep して、URL が `/carequest/` プレフィックス付きで出ているか確認する。

## 本番・AWS の制約

- 公開 URL: `https://veai.jp/carequest/`(S3 `veai-jp-toc-web` の `carequest/` プレフィックス、CloudFront `E32Z6UIZTZD6DE`)
- invalidation パスは `/carequest/*`
- **CloudFront は Free プランで cache behavior 上限に達している。専用 behavior を追加しない**
- ブランチ: `development` に集約 → 確認後 `main`(mainへのpushで本番デプロイ)
- 本番検証: `npm run aws:status` / `npm run smoke:backend` / `npm run smoke:prod`

## アイコン生成(macOS)

SVG から PNG を生成する再現手順:

```bash
qlmanage -t -s 512 -o /tmp icon.svg   # icon.svg.png (512px) が生成される
sips -z 192 192 icon.svg.png --out icon-192.png
sips -z 180 180 icon.svg.png --out apple-touch-icon.png
```

## 関連ドキュメント

- 戦略・ロードマップ: `docs/strategy.md`
- スキルマップ詳細: `docs/project-skills.md`
- タスク管理: `docs/project-management.md`
