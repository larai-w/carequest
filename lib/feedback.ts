// 匿名フィードバック送信。送るのは mood(3値)と任意のひとことだけで、
// ユーザー識別子・記録データは一切含めない(サインイン状態にも依存しない)。

export const FEEDBACK_MOODS = [
  { id: "good", emoji: "😊", label: "たすかっている" },
  { id: "okay", emoji: "😌", label: "ふつう" },
  { id: "hard", emoji: "😢", label: "つかいにくい" },
] as const;

export type FeedbackMood = (typeof FEEDBACK_MOODS)[number]["id"];

export const MAX_FEEDBACK_NOTE_LENGTH = 500;

export async function sendFeedback(
  mood: FeedbackMood,
  note?: string,
): Promise<boolean> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!apiBase) {
    return false;
  }

  const trimmedNote = note?.trim().slice(0, MAX_FEEDBACK_NOTE_LENGTH);
  const body: { mood: FeedbackMood; note?: string } = { mood };
  if (trimmedNote) {
    body.note = trimmedNote;
  }

  try {
    const response = await fetch(`${apiBase}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}
