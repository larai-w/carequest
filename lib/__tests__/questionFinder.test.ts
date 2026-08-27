import { describe, it, expect } from "vitest";
import {
  findArticles,
  publishedArticles,
  MIN_SCORE,
  MAX_HITS,
} from "@/lib/questionFinder";

// 2026-08-27 の実測を、そのままテストに落としたもの。
// (測定の記録は非公開リポの governance 配下にある)
//
// ⚠️ **公開日で結果が変わるので、日付を固定する。**
// そうしないと、記事が公開されるたびにテストが緑になったり赤になったりする。
const ALL = publishedArticles("2027-12-31"); // すべて公開済みとして扱う

const kindOf = (q: string) => findArticles(q, ALL).kind;
const topTitle = (q: string) => {
  const r = findArticles(q, ALL);
  return r.kind === "hits" ? r.hits[0].article.title : null;
};

describe("除外：止めるべきものを止める", () => {
  // **記事ではなく通報先を返す。** 形に関わらず必ず止める。
  it.each([
    "介護施設で虐待を受けているかもしれません",
    "父に叩かれました。どうすればいいですか",
    "母が意識がないです",
    "もう死にたいです",
    "本人が家から出て帰ってこない",
    "のどに詰まらせたみたいです",
  ])("緊急として止める: %s", (q) => {
    expect(kindOf(q)).toBe("emergency");
  });

  it.each([
    "胃ろうを作るか迷っています",
    "延命治療はすべきでしょうか",
    "薬を止めてもいいですか", // 実測で漏れた形(「〜てもいいですか」)
    "手術を受けるべきか決められない",
    "この副作用は危険ですか",
  ])("医療判断として止める: %s", (q) => {
    expect(kindOf(q)).toBe("medical");
  });

  it.each(["こんにちは", "father has dementia what should I do", "test", "ありがとう"])(
    "黙る: %s",
    (q) => {
      expect(kindOf(q)).toBe("silent");
    },
  );
});

describe("除外：止めてはいけないものを止めない", () => {
  // ⚠️ **ここが無いと、過剰に止まるガードを「良し」と判定してしまう。**
  // 実測で実際に1件見つかった(下の「施設の方針を聞く」)。
  it.each([
    "延命について家族で話し合いたいのですが、どう切り出せばいいですか",
    "看取りの体制がある施設かどうか、どう確かめますか",
    "人生会議とは何ですか",
    "胃ろうについて、施設の方針を聞くにはどうしたらいいですか", // 聞き方の質問。医療判断ではない
    "急変したときの連絡先を決めておきたい",
  ])("危ない語を含むが正当なので通す: %s", (q) => {
    expect(["hits", "none"]).toContain(kindOf(q));
  });

  it.each([
    "介護保険の自己負担は何割ですか",
    "ショートステイの持ち物は何が必要ですか",
    "福祉用具はレンタルできますか",
    "食事でむせるようになりました",
    "訪問診療と往診は何が違いますか",
    "住宅改修に助成はありますか",
  ])("普通の質問は通す: %s", (q) => {
    expect(kindOf(q)).toBe("hits");
  });
});

describe("除外の順番", () => {
  it("緊急を医療判断より先に見る", () => {
    // 後ろに置くと、医療語のほうに吸われて**通報先が出なくなる**。
    expect(kindOf("虐待されて薬を止めてもいいと言われました")).toBe("emergency");
  });
});

describe("一致度", () => {
  it.each([
    ["食事でむせるようになりました", "むせる"],
    ["訪問診療と往診は何が違いますか", "往診"],
    ["住宅改修に助成はありますか", "住宅改修"],
    ["移乗で腰を痛めそうです", "腰痛"],
  ])("%s → %s を含む記事が1位", (q, expected) => {
    expect(topTitle(q)).toContain(expected);
  });

  it("候補は3件まで", () => {
    // 多いほど「どれかは合っている」ように見えてしまう。
    const r = findArticles("介護保険の自己負担は何割ですか", ALL);
    expect(r.kind).toBe("hits");
    if (r.kind === "hits") expect(r.hits.length).toBeLessThanOrEqual(MAX_HITS);
  });

  it("下限を下回るものは返さない", () => {
    const r = findArticles("食事でむせるようになりました", ALL);
    if (r.kind === "hits") {
      for (const h of r.hits) expect(h.score).toBeGreaterThanOrEqual(MIN_SCORE);
    }
  });
});

describe("タグが、読者の語と書き手の語を橋渡しする", () => {
  // ⚠️ 2026-08-27 の実測: 終末期の記事4本のうち**3本は題名・説明・見出しの
  // どこにも「看取り」が出てこなかった。** 読者は「看取り」で探すのに、
  // 書き手は「人生会議」「予期悲嘆」と書く。**記事を増やしても見つからない。**
  // → タグを索引に入れて橋渡しする。
  it("看取りのタグが索引に入っている", () => {
    const tagged = ALL.filter((a) => (a.tags ?? []).includes("看取り"));
    expect(tagged.length).toBeGreaterThanOrEqual(3);
  });

  it("題名・説明・見出しに無い語でも、タグに有れば見つかる", () => {
    // ⚠️ **実データで測ろうとしたら、ガードにならなかった。**
    // 「最期をどこで迎えるか」はタグを索引から外しても通ってしまう
    // (別の語で当たっていた)。**通ることと効いていることは別。**
    // → タグ以外に手がかりが無い記事を、実データに1本混ぜて測る。
    //   1本だけの索引では IDF が成立しないので、実データと一緒に入れる。
    const tagged = {
      slug: "only-tag",
      title: "決めたあとも、気持ちは決まらない",
      description: "終わりが見えてきたときのこと。",
      pubDate: "2020-01-01",
      headings: ["予期悲嘆という呼び名"],
      tags: ["ホスピス"], // 題名にも説明にも見出しにも無く、他の記事にも無い語
    };
    const r = findArticles("ホスピスについて知りたいです", [...ALL, tagged]);
    expect(r.kind).toBe("hits");
    if (r.kind === "hits") expect(r.hits[0].article.slug).toBe("only-tag");
  });

  it.each(["最期をどこで迎えるか決めたい", "終末期について家族と話したい"])(
    "%s → 看取りを扱う記事が出る",
    (q) => {
      const r = findArticles(q, ALL);
      expect(r.kind).toBe("hits");
      if (r.kind === "hits") {
        const anyTagged = r.hits.some((h) => (h.article.tags ?? []).includes("看取り"));
        expect(anyTagged).toBe(true);
      }
    },
  );
});

describe("公開日", () => {
  it("予約公開の記事は、公開日まで候補に入らない", () => {
    // ⚠️ **未公開の記事へリンクすると 404 になる。**
    // 2026-08-27 に veai.jp 側で実際にやった。
    const early = publishedArticles("2020-01-01");
    expect(early.length).toBe(0);

    const all = publishedArticles("2027-12-31");
    expect(all.length).toBeGreaterThan(50);
  });

  it("公開日を迎えた記事は、索引を作り直さなくても候補に入る", () => {
    const someArticle = ALL.find((a) => a.pubDate > "2026-08-27");
    expect(someArticle).toBeDefined();
    // 同じ索引データから、日付だけで出し分けられている
    expect(publishedArticles("2026-08-27")).not.toContainEqual(someArticle);
    expect(publishedArticles("2027-12-31")).toContainEqual(someArticle);
  });
});
