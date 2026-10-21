// 画面に出すプロダクト名(表示名)。表示名を変えるときは、まずここを変える。
//
// ここは「見た目」だけを決める値。次のものはこの値に連動させないこと
// (変えると既存のデータや端末の状態が読めなくなる):
// - バックアップの形式識別子(lib/export.ts の EXPORT_FORMAT_ID)
// - localStorage のキー(carequest-*)、Service Worker のキャッシュ名、basePath(/carequest)
// - AWS 側のリソース名や CDK の construct ID
//
// いまの画面には「Care Quest」と「CareQuest」の2つの書き方がある。
// 書き方はまだ揃えていない。どちらに揃えるかは、あとでオーナーが決める。
// それまでは、いま画面に出ている書き方のとおりに2つの定数を使い分ける。
// app/ と components/ に名前を直接書かないこと(lib/__tests__/brand.test.ts で確かめている)。

// 「Care Quest」(あいだに空白あり)の箇所で使う。
export const PRODUCT_NAME = "Care Quest";

// 「CareQuest」(空白なし)の箇所で使う。例:「CareQuest へのひとこと」。
export const PRODUCT_NAME_COMPACT = "CareQuest";
