import type { CareLog, EnergyLevel } from "@/lib/types";

export function getEncouragementMessage(
  energyLevel: EnergyLevel,
  todayPoints: number,
  completedCount: number,
  latestTaskTitle?: string,
): string {
  if (energyLevel === "low") {
    return "今日は5ポイントだけでも十分です。あなたはもう支えています。";
  }

  if (completedCount === 0) {
    return "今日の中で、できたことをひとつだけ残してみましょう。";
  }

  if (todayPoints >= 30) {
    return "今日も小さな介護が、ちゃんと価値を持っています。";
  }

  if (latestTaskTitle) {
    return `${latestTaskTitle}を記録できたこと、今日の支えとしてちゃんと残っています。`;
  }

  return "今日できたことに、ちゃんと意味があります。";
}

/**
 * 当日のログから「今日のまとめ」本文を生成する純関数。
 * - 記録あり: 重複タイトルを除去し、最大3件+「など」で自然な日本語にまとめる
 * - 記録なし: 責めない文言を返す
 */
export function getTodaySummaryBody(logs: CareLog[]): string {
  if (logs.length === 0) {
    return "今日はまだ記録がありません。それも大切な一日です。";
  }

  // タイトルの重複を除去しつつ順序を保持する
  const seen = new Set<string>();
  const uniqueTitles: string[] = [];
  for (const log of logs) {
    if (!seen.has(log.title)) {
      seen.add(log.title);
      uniqueTitles.push(log.title);
    }
  }

  const MAX_TITLES = 3;
  const hasMore = uniqueTitles.length > MAX_TITLES;
  const displayTitles = uniqueTitles.slice(0, MAX_TITLES);

  if (displayTitles.length === 1) {
    return `今日は${displayTitles[0]}ができました。小さく見えても、大切な介護です。`;
  }

  const listed = displayTitles.join("、");
  const suffix = hasMore ? "などができました。" : "ができました。";
  return `今日は${listed}${suffix}小さく見えても、大切な介護です。`;
}

/**
 * あゆみメッセージ: ユーザー自身の記録数・日数から積み重ねを静かに認める文言を返す。
 * - 記録ゼロでも責めない
 * - 他者との比較なし(「競わせない」原則)
 */
export function getJourneyMessage(totalLogs: number, recordedDays: number): string {
  if (totalLogs === 0) {
    return "これからの記録が、ここに少しずつ残っていきます。今日の分だけで十分です。";
  }

  if (recordedDays >= 30) {
    return `${recordedDays}日分の支えが、ここに残っています。`;
  }

  if (recordedDays >= 7) {
    return `${recordedDays}日分の記録が積み重なっています。`;
  }

  if (totalLogs >= 1) {
    return `${totalLogs}件の支えが、ここに残っています。`;
  }

  return "これからの記録が、ここに少しずつ残っていきます。今日の分だけで十分です。";
}
