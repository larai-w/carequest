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
 * 記録が「いつのものか」を穏やかに表示するための文字列を返す。
 * - completedAt(ISO)が有効なら「M月D日 HH:MM」(ローカル時刻)。
 * - completedAt が無い/不正でも、date(YYYY-MM-DD)から「M月D日」を返す。
 * - どちらも無ければ空文字(表示側で出さない)。
 *
 * 7日間サマリのラベル(lib/stats.ts の「M月D日」)と表記を揃える。
 * 責めないトーン: 情報として添えるだけで「記録がない日」は示さない。
 */
export function formatLogWhen(completedAt: string, date: string): string {
  if (completedAt) {
    const d = new Date(completedAt);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
    }
  }
  const parts = date.split("-");
  if (parts.length === 3 && parts.every((p) => p !== "" && !Number.isNaN(Number(p)))) {
    return `${Number(parts[1])}月${Number(parts[2])}日`;
  }
  return "";
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
