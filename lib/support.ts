import type { DailyEnergy, EnergyLevel } from "@/lib/types";
import { getDateStringDaysAgo } from "@/lib/date";

// US-502: 「low」が続く介護者に、励ましだけで終わらせず相談窓口をそっと示す。
// ここは判定ロジックだけを純関数で持つ(DOM 非依存でテストできる)。
// design-principles.md の「押し付けない・here if you need」の姿勢に沿う。

// 相談窓口カードを出すのに必要な連続 low 日数。
export const CONSECUTIVE_LOW_DAYS = 3;
// カードを再表示するまでに最低限あける日数(表示は数日に1回まで)。
export const SUPPORT_NUDGE_MIN_GAP_DAYS = 3;

/**
 * その日のエネルギーレベルを履歴に記録する(同じ日は上書き = upsert)。
 * 日付は YYYY-MM-DD。返り値は新しい配列(元の配列は変更しない)。
 */
export function recordDailyEnergy(
  history: DailyEnergy[],
  date: string,
  energyLevel: EnergyLevel,
): DailyEnergy[] {
  const withoutToday = history.filter((entry) => entry.date !== date);
  return [...withoutToday, { date, energyLevel }];
}

/**
 * 直近が requiredDays 日以上、連続で low かどうかを判定する。
 *
 * 判定方針(誤検知を避けるため保守的に):
 * - 履歴のうち today 以前で最も新しい日を起点(anchor)にする。
 * - anchor が「昨日より前」しかない古いデータのときは出さない(stale を避ける)。
 * - anchor から1日ずつさかのぼり、その日に low の記録がある限り連続数を数える。
 *   記録の無い日(ギャップ)や low 以外が現れたら、そこで連続は途切れる。
 *   → ギャップを「連続」とみなさないので、まばらな記録では発火しない。
 */
export function hasConsecutiveLowEnergy(
  history: DailyEnergy[],
  today: string,
  requiredDays: number = CONSECUTIVE_LOW_DAYS,
): boolean {
  if (history.length === 0) return false;

  // date -> energyLevel のマップ(upsert 運用なので同日重複は無い想定)。
  const byDate = new Map<string, EnergyLevel>();
  for (const entry of history) {
    byDate.set(entry.date, entry.energyLevel);
  }

  // today 以前で最も新しい記録日を anchor にする。
  let anchor = "";
  for (const date of byDate.keys()) {
    if (date <= today && date > anchor) {
      anchor = date;
    }
  }
  if (anchor === "") return false;

  // stale ガード: anchor が昨日より前(=今日でも昨日でもない)なら出さない。
  const yesterday = getDateStringDaysAgo(today, 1);
  if (anchor < yesterday) return false;

  // anchor から1日ずつさかのぼって連続 low を数える。
  let streak = 0;
  let cursor = anchor;
  while (byDate.get(cursor) === "low") {
    streak += 1;
    if (streak >= requiredDays) return true;
    cursor = getDateStringDaysAgo(cursor, 1);
  }
  return false;
}

/**
 * いま相談窓口カードを表示すべきか。
 * 連続 low を満たし、かつ最後に表示してから十分な日数があいていれば true。
 */
export function shouldShowSupportNudge(
  input: { energyHistory: DailyEnergy[]; supportNudgeLastShown: string },
  today: string,
  minGapDays: number = SUPPORT_NUDGE_MIN_GAP_DAYS,
): boolean {
  if (!hasConsecutiveLowEnergy(input.energyHistory, today)) return false;

  // throttle: 最後の表示が (today - minGapDays) より新しければ、まだ出さない。
  // 空文字("未表示")は常に通す。日付文字列は辞書順 = 時系列順で比較できる。
  const last = input.supportNudgeLastShown;
  if (last !== "" && last > getDateStringDaysAgo(today, minGapDays)) {
    return false;
  }
  return true;
}
