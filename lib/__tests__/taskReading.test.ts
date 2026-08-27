import { describe, it, expect } from "vitest";
import { readingForTask, PAIRED_TASKS } from "@/lib/taskReading";
import indexData from "@/lib/blogIndex.json";

// 2026-08-28 の測定を受けたテスト。
// **一致度で自動的に選ぶのは却下した**（動詞で当たってスコアだけ高く出る）。
// ここで守るのは「手で選んだものだけ出す」ことと「未公開を出さない」こと。

describe("対応表", () => {
  it("対応表のスラッグが、すべて実在する記事を指している", () => {
    // ⚠️ 記事が改名・削除されると**黙ってリンク切れになる**。
    const slugs = new Set((indexData.articles as { slug: string }[]).map((a) => a.slug));
    for (const task of PAIRED_TASKS) {
      const r = readingForTask(task, "2027-12-31");
      expect(r, `${task} の対応先が索引に無い`).not.toBeNull();
      expect(slugs.has(r!.slug)).toBe(true);
    }
  });

  it("対応表に無いタスクには、何も出さない", () => {
    // **無理に出さない。** 外れた候補を出すくらいなら何も出さないほうがいい。
    for (const t of ["声をかけた", "一緒に笑った", "食事を用意した", "楽しい時間をすごした"]) {
      expect(readingForTask(t, "2027-12-31")).toBeNull();
    }
  });

  it("知らないタスク名でも落ちない", () => {
    expect(readingForTask("", "2027-12-31")).toBeNull();
    expect(readingForTask("自分で作ったタスク", "2027-12-31")).toBeNull();
  });
});

describe("公開日", () => {
  it("公開日を過ぎていない記事は出さない", () => {
    // **未公開の記事へのリンクは 404 になる。**
    const early = readingForTask("自分も休憩した", "2020-01-01");
    expect(early).toBeNull();
  });

  it("公開日を過ぎたら出る", () => {
    const later = readingForTask("自分も休憩した", "2027-12-31");
    expect(later).not.toBeNull();
    expect(later!.url).toContain("/ja/blog/");
  });

  it("今日の時点では、公開済みのものだけが出る", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const task of PAIRED_TASKS) {
      const r = readingForTask(task, today);
      if (r) {
        const a = (indexData.articles as { slug: string; pubDate: string }[]).find((x) => x.slug === r.slug)!;
        expect(a.pubDate <= today, `${task} → ${r.slug} が未公開`).toBe(true);
      }
    }
  });
});

describe("文言", () => {
  it("記録を評価する言い方をしていない", () => {
    // **記録した行為を「足りない」と示唆しない。**
    // 体調が悪い日に画面から評価されるのは、続ける力を削る。
    const banned = ["ましょう", "べき", "してください", "足りない", "もっと"];
    for (const task of PAIRED_TASKS) {
      const r = readingForTask(task, "2027-12-31");
      for (const w of banned) {
        expect(r!.why.includes(w), `${task} の説明に「${w}」が入っている`).toBe(false);
      }
    }
  });
});
