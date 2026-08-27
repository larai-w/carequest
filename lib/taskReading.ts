// 記録したことに関連する読みものを、**手で選んだ対応表**から出す。
//
// ⚠️ **一致度で自動的に選ぶのは、測って却下した（2026-08-28）。**
// 既定タスク13件を質問検索にかけたところ、スコアは 70〜91 と高いのに
// **中身がまったく合っていなかった**:
//
//   「薬を渡した」   → 「困ったらこれ」を**渡す**日   （「渡す」で一致）
//   「食事を用意した」 → ショートステイの持ち物        （「用意」で一致）
//   「声をかけた」   → 「おかえりなさい」と…         （「声」で一致）
//
// タスク名は短い一般語なので、**動詞で当たってスコアだけ高く出る。**
// 質問検索より条件が悪い。**利用者は何も聞いていない**のに出てくるぶん、
// 外したときの害も大きい。
//
// → **精度が要る場面では、機械に選ばせない。** 手で選んだものだけ出す。
import indexData from "./blogIndex.json";

type Pair = {
  /** 既定タスクの title と完全一致で引く */
  task: string;
  slug: string;
  /** なぜこの読みものなのかを一言。**記録を評価する言い方にしない。** */
  why: string;
};

// ⚠️ **迷ったら入れない。** 外れた候補を出すくらいなら、何も出さないほうがいい。
// 記録した行為を「足りない」と示唆する書き方にしない。
const PAIRS: Pair[] = [
  {
    task: "自分も休憩した",
    slug: "yougo-respite-care",
    why: "休むための制度があります",
  },
  {
    task: "薬を渡した",
    slug: "yougo-fukuyaku-adherence",
    why: "飲み忘れは意思の問題ではない、という話",
  },
  {
    task: "おむつ交換をした",
    slug: "yougo-omutsu-josei",
    why: "おむつ代の助成がある自治体があります",
  },
  {
    task: "病院・通院に付き添った",
    slug: "yougo-kaigo-taxi",
    why: "車いすのまま乗れる移動の手段",
  },
  {
    task: "手続き・調整をした",
    slug: "yougo-tantousha-kaigi",
    why: "家族が出られる場のこと",
  },
];

export type Reading = { slug: string; title: string; why: string; url: string };

const BLOG = "https://veai.jp/ja/blog/";

/**
 * 記録したタスクに対応する読みものを返す。無ければ null。
 *
 * **公開日を過ぎていない記事は返さない。** 未公開の記事へのリンクは 404 になる。
 */
export function readingForTask(
  taskTitle: string,
  today = new Date().toISOString().slice(0, 10),
): Reading | null {
  const pair = PAIRS.find((p) => p.task === taskTitle);
  if (!pair) return null;

  const article = (indexData.articles as { slug: string; title: string; pubDate: string }[]).find(
    (a) => a.slug === pair.slug,
  );
  if (!article) return null; // 索引に無い(記事が消えた/改名した)
  if (article.pubDate > today) return null; // まだ公開されていない

  return { slug: article.slug, title: article.title, why: pair.why, url: `${BLOG}${article.slug}/` };
}

/** 対応表に載っているタスク名（テストと保守用） */
export const PAIRED_TASKS = PAIRS.map((p) => p.task);

// ── 1日1回までの制御 ────────────────────────────────────────
// **記録のたびに出すと、記録が「何か言われる行為」になる。**
// 端末の中だけに持つ。読めない環境（プライベートウィンドウ等）では
// 「まだ出していない」と扱う（**出せないより、出るほうがまし**な軽い機能）。
const SHOWN_KEY = "carequest-reading-shown-v1";

export function alreadyShownToday(today = new Date().toISOString().slice(0, 10)): boolean {
  try {
    return window.localStorage.getItem(SHOWN_KEY) === today;
  } catch {
    return false;
  }
}

export function markShownToday(today = new Date().toISOString().slice(0, 10)): void {
  try {
    window.localStorage.setItem(SHOWN_KEY, today);
  } catch {
    // 保存できなくても記録の邪魔をしない
  }
}
