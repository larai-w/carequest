// 画面に出すプロダクト名(表示名)。表示名を変えるときは、まずここを変える。
//
// ここは「見た目」だけを決める値。次のものはこの値に連動させないこと
// (変えると既存のデータや端末の状態が読めなくなる):
// - バックアップの形式識別子(lib/export.ts の EXPORT_FORMAT_ID)
// - localStorage のキー(carequest-*)、Service Worker のキャッシュ名、basePath(/carequest)
// - AWS 側のリソース名や CDK の construct ID
//
// いまの画面には「Care Quest」と「CareQuest」の2つの書き方がある。
// この定数は「Care Quest」の箇所だけで使っている(書き方は揃えていない)。
export const PRODUCT_NAME = "Care Quest";
