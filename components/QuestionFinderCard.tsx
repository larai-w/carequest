"use client";

import { useState } from "react";
import { findArticles, type Outcome } from "@/lib/questionFinder";

// 介護の質問に、veai.jp の読みものを候補として出すカード。
//
// **「答え」として出さない。「関連する読みもの」として出す。**
// 外れたときの害がまったく違う。実測(2026-08-27)では、答えが無い問いに
// **無関係な記事を自信ありげに返していた**(虐待の相談に持ち物の記事、
// 胃ろうの相談に音声メモの記事)。言い切る UI だと、その誤りがそのまま届く。
//
// **質問は端末から出ない。** 検索も判定もこのブラウザの中で完結する。
// 介護の質問は機微なので、これは仕様。

const BLOG = "https://veai.jp/ja/blog/";

export default function QuestionFinderCard() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Outcome | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setResult(findArticles(q));
  };

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white/80 p-4 shadow-sm">
      <h2 className="text-sm font-medium text-stone-700">介護のことで、調べたいことはありますか</h2>
      <p className="mt-1 text-xs leading-6 text-stone-500">
        近い読みものをお探しします。入力した内容はこの端末から出ません。
      </p>

      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例: 食事でむせるようになりました"
          aria-label="調べたいこと"
          className="min-h-[44px] flex-1 rounded-full border border-stone-200 bg-white px-4 text-sm text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        />
        <button
          type="submit"
          className="min-h-[44px] rounded-full bg-stone-700 px-5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          さがす
        </button>
      </form>

      {result && <Result result={result} />}
    </section>
  );
}

function Result({ result }: { result: Outcome }) {
  // 何も出さない(挨拶・日本語でない入力)。**取り繕わない。**
  if (result.kind === "silent") return null;

  if (result.kind === "emergency") {
    // 警告色(赤)は使わない。急かす配色は、慌てている人をさらに慌てさせる。
    return (
      <div className="mt-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
        <p className="whitespace-pre-line text-sm leading-7 text-stone-700">{result.message}</p>
      </div>
    );
  }

  if (result.kind === "medical" || result.kind === "none") {
    return (
      <div className="mt-3 rounded-[20px] border border-stone-200 bg-stone-50 p-4">
        <p className="text-sm leading-7 text-stone-700">{result.message}</p>
      </div>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {result.hits.map(({ article }) => (
        <li key={article.slug}>
          <a
            href={`${BLOG}${article.slug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-[20px] border border-stone-200 bg-white p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <span className="text-sm font-medium text-stone-700">{article.title}</span>
            <span className="mt-1 block text-xs leading-6 text-stone-500">{article.description}</span>
          </a>
        </li>
      ))}
      <li className="pt-1 text-xs leading-6 text-stone-400">
        これは読みものの候補です。制度の判断はケアマネジャーやお住まいの市区町村へ、
        体調に関わることは主治医にご相談ください。
      </li>
    </ul>
  );
}
