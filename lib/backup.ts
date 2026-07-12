import type { CareLog } from "@/lib/types";
import type { CareStorageState } from "@/lib/storage";
import { mergeLogs } from "@/lib/import";

/**
 * サーバーから取得した logs を、既存優先でローカル状態にマージした
 * 新しい CareStorageState を返す純関数(DOM 非依存 = テスト可能)。
 *
 * 設計(design-sync.md §3):
 * - logs 以外(note / user / customTasks / energyHistory 等)は一切変更しない。
 * - 既存優先: ローカルの記録がサーバーの内容で上書きされることはない。
 *   まだ手元に無い id の記録だけを足す。
 */
export function mergeRestoredLogs(
  state: CareStorageState,
  fetchedLogs: CareLog[],
): { state: CareStorageState; importedLogCount: number } {
  const { logs, newCount } = mergeLogs(state.logs, fetchedLogs);
  return { state: { ...state, logs }, importedLogCount: newCount };
}

/**
 * 配列を size ごとのチャンクに分割する。
 * バックアップ送信を API スロットリング(T29: 10rps)内に収めるために使う
 * (数百件を一気に投げない・design-sync.md §6 E-3)。
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return items.length === 0 ? [] : [items];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
