/**
 * goodThingsHistory から今日の items を取り出す純関数。
 * 当日のエントリがなければ空配列(まっさらな状態)を返す。
 */
export function getTodayGoodThings(
  goodThingsHistory: { date: string; items: string[] }[],
  today: string,
): string[] {
  const entry = goodThingsHistory.find((g) => g.date === today);
  return entry ? [...entry.items] : [];
}

/**
 * goodThingsHistory の今日分を更新した新しい配列を返す純関数。
 * items が空になった日はエントリごと削除して空エントリを溜めない。
 */
export function setTodayGoodThings(
  goodThingsHistory: { date: string; items: string[] }[],
  today: string,
  items: string[],
): { date: string; items: string[] }[] {
  const without = goodThingsHistory.filter((g) => g.date !== today);
  if (items.length === 0) {
    // items が空になった日はエントリを残さない
    return without;
  }
  return [...without, { date: today, items }];
}
