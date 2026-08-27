// 介護の質問に、veai.jp の読みものを候補として出す。
//
// **すべて端末の中で動く。** 質問はネットワークに出ない。
// 介護の質問は機微(家族の状態・お金・看取り)なので、これは仕様であって
// 実装の都合ではない。索引は lib/blogIndex.json に同梱している。
//
// ── 設計の根拠(2026-08-27 の実測) ───────────────────────────────
// 30問で測ったところ、**当てる側は足りていた**が、
// **答えが無い問いに黙れたのは 0/5** だった。
// そして**閾値では分離できない**: 答えがある問いの最低スコアが 33 に対し、
// 答えが無い問いは 11/17/24/**35**/**79**(英語の質問が 78.6、
// 「看取りの準備」が 35)。どこに線を引いても通り抜ける。
//
// → **除外を一致度より先に当てる。それがこの機能の本体。**
//   除外を入れて 25/25、一致度は候補3件で 24/25。
//   (測定の記録は非公開リポの governance 配下にある)
// ────────────────────────────────────────────────────────────
import indexData from "./blogIndex.json";

export type Article = {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  headings: string[];
  tags: string[];
};

export type Outcome =
  | { kind: "emergency"; message: string; hits: [] }
  | { kind: "medical"; message: string; hits: [] }
  | { kind: "silent"; message: null; hits: [] }
  | { kind: "none"; message: string; hits: [] }
  | { kind: "hits"; message: null; hits: { score: number; article: Article }[] };

// ① 緊急・安全。**形に関わらず必ず止める。**
// ここは取りこぼすより過剰に止めるほうがまし。記事ではなく連絡先を返す。
const EMERGENCY = [
  "虐待", "叩か", "殴", "暴力", "怒鳴", "縛", "拘束",
  "死にたい", "消えたい", "殺", "自殺", "自傷",
  "意識がな", "息をして", "呼吸がな", "反応がな", "倒れて",
  "大量に出血", "血が止ま", "骨折", "けいれん", "痙攣",
  "行方不明", "帰ってこな", "火事", "誤飲", "のどに詰ま", "窒息",
];

// ② 医療判断。**キーワードだけでは止めない。**
// 「延命について家族で話し合いたい」は人生会議の記事が答えになる。
// 「延命治療はすべきでしょうか」は主治医の領域。
const MEDICAL_TOPIC = [
  "胃ろう", "胃瘻", "延命", "人工呼吸", "気管切開", "輸血", "手術",
  "抗がん", "余命", "診断", "副作用", "服薬を中止", "薬を止め",
  "薬を変え", "量を減ら", "処方を", "点滴", "経管栄養", "透析",
];
const DECISION_SEEKING = [
  "すべき", "するべき", "したほうが", "した方が", "しないほうが",
  "迷って", "決められない", "どうしたら", "どうすれば", "どちらが",
  "やめても", "やめるべき", "必要ですか", "大丈夫ですか", "危険ですか",
  "てもいい", "ていい", "ても平気",
];
// ⚠️ **除外を強くすると、正当な質問まで止まる。**
// 実測で「胃ろうについて、施設の方針を聞くにはどうしたらいいですか」が
// 医療判断として止まった。これは**聞き方の質問**であって医療判断ではない。
const PROCEDURAL = [
  "聞く", "聞き", "確かめ", "話し合", "切り出", "伝え",
  "方針", "手続き", "書面", "どこに", "誰に", "窓口", "相談先",
];

const GREETING = ["こんにちは", "こんばんは", "おはよう", "はじめまして", "ありがとう", "テスト"];

export const EMERGENCY_MESSAGE =
  "緊急の可能性があります。読みものではなく、こちらへご連絡ください。\n" +
  "・命に関わるとき → 119\n" +
  "・虐待のご相談 → お住まいの市区町村／地域包括支援センター";
export const MEDICAL_MESSAGE =
  "この判断は主治医・訪問看護師にご相談ください。読みものではお答えできない内容です。";
export const NONE_MESSAGE =
  "近い読みものが見つかりませんでした。お住まいの地域包括支援センターにご相談ください。";

const hasJapanese = (s: string) => /[぀-ヿ一-龥]/.test(s);

/** 除外判定。止めるなら結果を返す。通すなら null。 */
function screen(q: string): Outcome | null {
  const text = q.trim();

  // ⚠️ **順番が意味を持つ。** 緊急を最初に見る。医療語を先に見ると
  // 「虐待されて薬を飲まされている」が医療扱いになり、通報先が出ない。
  if (EMERGENCY.some((k) => text.includes(k))) {
    return { kind: "emergency", message: EMERGENCY_MESSAGE, hits: [] };
  }

  if (MEDICAL_TOPIC.some((k) => text.includes(k)) && DECISION_SEEKING.some((d) => text.includes(d))) {
    // 段取りを聞いている形なら、医療判断ではないので通す
    if (!PROCEDURAL.some((p) => text.includes(p))) {
      return { kind: "medical", message: MEDICAL_MESSAGE, hits: [] };
    }
  }

  if (!hasJapanese(text)) return { kind: "silent", message: null, hits: [] };
  if (text.length < 4) return { kind: "silent", message: null, hits: [] };
  if (GREETING.some((g) => text.startsWith(g) && text.length <= g.length + 3)) {
    return { kind: "silent", message: null, hits: [] };
  }
  return null;
}

// ── 一致度 ────────────────────────────────────────────────────
// 言い換え表。**実測で外れた分だけ入れる。思いつきで足さない。**
// 検証セットに合わせて足すと、数字が意味を失う。
const SYNONYMS: Record<string, string[]> = {
  自己負担: ["負担割合証", "負担割合"],
  何割: ["負担割合証", "負担割合"],
  補助: ["助成"],
  手すり: ["住宅改修"],
  孤立: ["家族会", "認知症カフェ"],
  話せる場所: ["家族会", "認知症カフェ"],
  話し相手: ["家族会", "認知症カフェ"],
  腰を痛: ["腰痛"],
  持ち上げ: ["移乗", "腰痛"],
  看取り: ["最期", "終末期"],
  むせる: ["誤嚥", "嚥下"],
  飲み込め: ["誤嚥", "嚥下"],
  呼ぶ: ["往診"],
  医療費: ["高額療養費"],
};

const expand = (q: string) =>
  q + Object.entries(SYNONYMS).filter(([k]) => q.includes(k)).flatMap(([, v]) => v).join("");

const bigrams = (s: string): Set<string> => {
  const t = s.replace(/[\s、。「」『』（）()・—\-]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};

const articleText = (a: Article) =>
  // タグは短いので、繰り返して重みを持たせる。
  // **読者の語（看取り）と書き手の語（人生会議）を橋渡しするのがタグの役割。**
  a.title.repeat(3) + a.description.repeat(2) + a.headings.join("") + (a.tags ?? []).join("").repeat(2);

// ⚠️ **重みを下げるだけでは足りない。** 機能語は分母に残り続ける。
// 実測: 「住宅改修に助成はありますか」で `に・は・あり・ます・すか` が効き、
// **正解記事が無関係な記事と同点(33.3)**になった。
// → 記事の3割以上に出る2文字は、**分子からも分母からも外す**。
const STOPWORD_DF_RATIO = 0.3;

type Index = { idf: Map<string, number>; stop: Set<string>; articles: Article[] };
let cached: Index | null = null;

function buildIndex(articles: Article[]): Index {
  const df = new Map<string, number>();
  for (const a of articles) {
    for (const b of bigrams(articleText(a))) df.set(b, (df.get(b) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  const stop = new Set<string>();
  for (const [b, c] of df) {
    idf.set(b, Math.log(articles.length / c) + 1);
    if (c >= articles.length * STOPWORD_DF_RATIO) stop.add(b);
  }
  return { idf, stop, articles };
}

function score(qb: Set<string>, a: Article, idx: Index): number {
  const ab = bigrams(articleText(a));
  let total = 0;
  let got = 0;
  for (const b of qb) {
    const w = idx.idf.get(b) ?? 1;
    total += w;
    if (ab.has(b)) got += w;
  }
  return total ? (100 * got) / total : 0;
}

// ⚠️ **閾値は、記事の本数で意味が変わる。**
//
// 最初 33 にしていた。これは**全93記事で測った値**だったが、
// 索引は公開日で絞るので、**本番で実際に使われる本数はもっと少ない。**
// 2026-08-27 の本番投入時点では 38本しか公開されていなかった。
//
// 記事が少ないと競争相手が減り、**弱い一致がそのまま1位になる。** 実測:
//
//   閾値 | 38本 当/外/黙 | 93本 当/外/黙
//    33  |   6/**7**/3   |  15/1/0
//    40  |   6/2/8       |  13/2/1
//    45  |   4/**0**/12  |  13/1/2
//    50  |   3/0/13      |   8/1/7
//
// **沈黙は安全な出口**（地域包括支援センターへ案内する）。
// **それらしい誤りを返すほうが害が大きい**ので、外れが消える 45 を取る。
// 全記事でも 15→13 の目減りで収まる。
//
// 記事が増えたら測り直してよい。**そのときも「今日公開されている本数」で測る。**
export const MIN_SCORE = 45;
export const MAX_HITS = 3; // 多いほど「どれかは合っている」ように見えてしまう

/** 公開済みの記事だけを返す。予約公開の記事は公開日を迎えたら自然に入る。 */
export function publishedArticles(today = new Date().toISOString().slice(0, 10)): Article[] {
  return (indexData.articles as Article[]).filter((a) => a.pubDate <= today);
}

export function findArticles(question: string, articles?: Article[]): Outcome {
  const blocked = screen(question);
  if (blocked) return blocked;

  const list = articles ?? publishedArticles();
  if (!cached || cached.articles !== list) cached = buildIndex(list);

  const qbAll = bigrams(expand(question));
  const qb = new Set([...qbAll].filter((b) => !cached!.stop.has(b)));
  const use = qb.size ? qb : qbAll; // 全部落ちたら元に戻す

  const ranked = list
    .map((article) => ({ score: score(use, article, cached!), article }))
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_HITS)
    .filter((h) => h.score >= MIN_SCORE);

  if (!ranked.length) return { kind: "none", message: NONE_MESSAGE, hits: [] };
  return { kind: "hits", message: null, hits: ranked };
}
