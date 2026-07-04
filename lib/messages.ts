import type { EnergyLevel } from "@/lib/types";

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

export function getCommunityMessage(totalPoints: number, participantCount: number): string {
  if (totalPoints >= 13000) {
    return "今日も、たくさんの介護者の支えが、ここに集まっています。";
  }

  if (participantCount >= 200) {
    return "今日もどこかで、誰かの安心につながる支えが続いています。";
  }

  return "今日も、どこかで誰かが一緒に支えています。";
}
