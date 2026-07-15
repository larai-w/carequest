# drafts/ の運用

ブログ記事(veai.jp の「読みもの」/ja/blog/)と SNS 素材の置き場。

## フロー

1. **ここ(drafts/ 直下)に下書き**を置く — ⚠️DRAFT ヘッダ + `pubDate: 'YYYY-MM-XX'` のまま
2. **オーナーがチェック**してツッコミ/OK
3. OK が出たら **veai-jp-web の `src/content/blog/` へコピーして公開**(DRAFTヘッダ除去・実日付化・`lang: 'ja'`・push で自動デプロイ・ライブ確認)
4. 公開した下書きは **`deployed/` へ移動**する(直下 = 未公開・チェック待ち、deployed/ = 公開済み)

## いまの状態

- **直下**: チェック待ちの下書き
- **deployed/**: 公開済み(ライブは https://veai.jp/ja/blog/ )
- **x-post-ideas.md**: X(@uru_larav)投稿のネタ帳

コンテンツ戦略の全体像は [docs/strategy.md](../docs/strategy.md) §3.2.5 を参照。
