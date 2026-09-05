"use client";

import { useState } from "react";
import {
  FEEDBACK_MOODS,
  MAX_FEEDBACK_NOTE_LENGTH,
  sendFeedback,
  type FeedbackMood,
} from "@/lib/feedback";

type SendStatus = "idle" | "sending" | "sent" | "error";

export default function FeedbackWidget() {
  const [mood, setMood] = useState<FeedbackMood | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");

  const handleSend = async () => {
    if (!mood || status === "sending") return;
    setStatus("sending");
    const ok = await sendFeedback(mood, note);
    setStatus(ok ? "sent" : "error");
  };

  if (status === "sent") {
    return (
      <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-800">ありがとうございます</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          いただいた声は、CareQuest をよくするための検討に使います。内容を公開することはありません。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-800">CareQuest へのひとこと</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">
        匿名で届きます。記録の内容は送られません。お名前や連絡先は書かないでください。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FEEDBACK_MOODS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setMood(option.id)}
            aria-pressed={mood === option.id}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              mood === option.id
                ? "border-stone-800 bg-stone-800 text-white"
                : "border-stone-200 bg-stone-50 text-stone-700"
            }`}
          >
            {option.emoji} {option.label}
          </button>
        ))}
      </div>
      {mood && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_FEEDBACK_NOTE_LENGTH}
            rows={3}
            placeholder="よければ、ひとことも(任意)"
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={status === "sending"}
            className="rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {status === "sending" ? "送信中…" : "送信する"}
          </button>
          {status === "error" && (
            <p className="text-sm text-stone-600">
              送れませんでした。電波のよいところで、また試してみてください。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
