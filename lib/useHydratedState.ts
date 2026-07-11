"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * localStorage 由来のクライアント専用状態を、hydration mismatch なしに扱うためのフック。
 *
 * 背景:
 *   本アプリは静的エクスポート(output: "export")なので、全ページはビルド時に
 *   「localStorage を読めない状態(= サーバー既定値)」でプリレンダーされる。
 *   一方で従来は useState の遅延初期化で直接 localStorage を読んでいたため、
 *   プリレンダー HTML とクライアント初回描画が食い違い、
 *   "Hydration failed because the server rendered text didn't match the client"
 *   が発生していた。
 *
 * 解決パターン(useSyncExternalStore を使った canonical な hydration フラグ方式):
 *   1. useSyncExternalStore の getServerSnapshot が hydration 中は false を返し、
 *      getSnapshot がマウント後は true を返す。これにより React が hydration の
 *      タイミングを正確に検知できる。
 *   2. hydration 中の描画は必ず serverState(= サーバー HTML と一致するので mismatch しない)。
 *   3. hydration 完了後に useSyncExternalStore が true を返して再描画され、
 *      クライアントの実データ(loadClientState の遅延初期化値)に切り替わる。
 *   useEffect 内での setState を排除したため react-hooks/set-state-in-effect の
 *   lint エラーが発生しない。
 *
 * ちらつき対策:
 *   `serverState` は「空データでも成立するカードの骨組み」を出せる形にしておく。
 *   ページ側は Layout やカード枠を常に描画し、localStorage 由来の値だけを差し替えるため、
 *   真っ白な画面やレイアウトシフトを最小化できる。
 *
 * @param serverState サーバー/初回描画で使う既定状態(localStorage を読まない値)。
 * @param loadClientState useState の遅延初期化関数。クライアントでのみ実行される実データのローダー。
 * @returns [state, setState, hydrated]
 *   - state: 現在の状態(hydration 中は serverState、hydration 完了後は実データ)。
 *   - setState: 通常の React setState。ユーザー操作による更新に使う。
 *   - hydrated: hydration 完了(= 実データに切り替わった)なら true。
 */

// 購読なし(外部ストアの値は変わらない)。
// React の useSyncExternalStore の契約を満たすために空の subscribe 関数を渡す。
const emptySubscribe = () => () => {};

export function useHydratedState<T>(
  serverState: T,
  loadClientState: () => T,
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  // hydration 中は getServerSnapshot(false)、マウント後は getSnapshot(true) が使われる。
  // これが React 標準の「サーバーとクライアントで異なる初期値を安全に持つ」パターン。
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // 遅延初期化はクライアントでのみ実行される(関数を渡すことで useState が呼び出す)。
  // useEffect 内での setState を使わないため cascading render の懸念がない。
  const [state, setState] = useState<T>(loadClientState);

  // hydration 中の描画は必ず serverState(サーバー HTML と一致)。
  // hydration 完了後は実データの state を返す。
  return [hydrated ? state : serverState, setState, hydrated];
}
