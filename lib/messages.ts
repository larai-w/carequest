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

export function getCommunityMessage(totalPoints: number, participantCount: number): string {
  if (totalPoints >= 13000) {
    return "今日も、たくさんの介護者の支えが、ここに集まっています。";
  }

  if (participantCount >= 200) {
    return "今日もどこかで、誰かの安心につながる支えが続いています。";
  }

  return "今日も、どこかで誰かが一緒に支えています。";
}
