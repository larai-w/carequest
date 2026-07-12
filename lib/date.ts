/**
 * 日付ユーティリティ
 *
 * 全関数はローカルタイムゾーン基準で動作します。
 * タイムゾーンライブラリは使用せず、Date の getFullYear/getMonth/getDate を利用して
 * UTC 基準になるバグ（JST 深夜0時〜9時に前日扱いになる問題）を回避します。
 */

/**
 * 端末のローカルタイムゾーン基準で今日の日付文字列 (YYYY-MM-DD) を返す。
 */
export function getTodayDate(): string {
  return formatLocalDate(new Date());
}

/**
 * Date オブジェクトをローカルタイムゾーン基準で YYYY-MM-DD 形式にフォーマットする。
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * today (YYYY-MM-DD) から n 日前の日付文字列をローカル日付基準で返す。
 *
 * DST（夏時間）のある地域でも壊れないよう、setDate で日数を減算し
 * 文字列連結では計算しない。
 */
export function getDateStringDaysAgo(today: string, n: number): string {
  // today を "当日の00:00:00 (ローカル)" として解釈する
  // "YYYY-MM-DD" を Date コンストラクタに渡すと UTC midnight になるため
  // getFullYear/getMonth/getDate を手動でパースしてローカル midnight の Date を作る。
  const [yearStr, monthStr, dayStr] = today.split("-");
  const base = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
  base.setDate(base.getDate() - n);
  return formatLocalDate(base);
}
