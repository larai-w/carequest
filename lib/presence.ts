// 今日のともしび(T54 / US-401 の最小形)の表示文言。
//
// 5人以上のときだけ人数を出す。少人数の日・取得前・取得失敗はすべて同じ
// 穏やかな文言に落とし、小さな数字で寂しさを見せない(「閾値未満は集計を
// 出さない」原則)。エラーやスピナーもユーザーには見せない。
export const PRESENCE_DISPLAY_THRESHOLD = 5;

export function presenceMessage(count: number | null): string {
  if (count !== null && count >= PRESENCE_DISPLAY_THRESHOLD) {
    return `今日、${count}人の介護者が記録しました。`;
  }
  return "今日も、どこかで誰かが介護しています。";
}
