import { loadCareState, saveCareState } from "@/lib/storage";
import { backupCareLogs, fetchCareEntries, isSignedIn } from "@/lib/api";
import { mergeRestoredLogs } from "@/lib/backup";

// サインイン時の自動同期(Phase B)。Phase A の関数(復元・バックアップ)を
// オーケストレーションするだけで、新しい同期ロジックは発明しない。
//
// 方針(design-sync.md §5 Phase B / §4.3):
// - 復元(サーバー→ローカル)→ バックアップ(ローカル→サーバー)の順に実行。
//   先に復元して和集合を作り、その全 logs を冪等 PUT で送る。
// - すべて背景で静かに。失敗は握りつぶし、次のトリガー(次回サインイン・次回記録)で
//   再送する。冪等 PUT(T27)なので単純再送で安全。指数バックオフ等は入れない。
// - ローカルは source of truth。復元は「既存優先」でローカルを上書きしない。

// 背景同期で localStorage を更新したことを画面へ知らせるイベント名。
// マウント中のページ(特にホーム = AuthPanel + 今日の記録を表示)が
// これを購読して表示を最新化する。
export const SYNC_EVENT_NAME = "carequest:synced";

function notifySynced(): void {
  try {
    window.dispatchEvent(new Event(SYNC_EVENT_NAME));
  } catch {
    // SSR や dispatchEvent 不可環境では何もしない(同期自体は完了している)。
  }
}

export interface SignInSyncResult {
  // 未サインイン(同期不要・ローカル保存で完結が正常)。
  skipped: boolean;
  // 復元で新たにローカルへ足された記録の件数。
  restoredCount: number;
  // バックアップが(全件)成功したか。失敗しても記録はローカルに残る。
  backedUp: boolean;
}

/**
 * サインイン成功時に呼ぶ自動同期。復元 → バックアップの順に背景実行する。
 * どの段で失敗してもローカルの記録は無傷。次トリガーで再送される。
 */
export async function syncOnSignIn(): Promise<SignInSyncResult> {
  if (!(await isSignedIn())) {
    return { skipped: true, restoredCount: 0, backedUp: false };
  }

  // 1. 復元(サーバー→ローカル)。fetchCareEntries は sanitize 済みの入口(T31)。
  //    既存優先マージなのでローカルの記録は上書きされない。
  let restoredCount = 0;
  try {
    const fetched = await fetchCareEntries();
    const { state, importedLogCount } = mergeRestoredLogs(loadCareState(), fetched);
    if (importedLogCount > 0) {
      saveCareState(state);
      restoredCount = importedLogCount;
      // 復元で表示すべき記録が増えたので、マウント中のページに再読込を促す。
      notifySynced();
    }
  } catch {
    // 復元失敗は握る。ローカルは無傷なので、記録操作をブロックしない。
  }

  // 2. バックアップ(ローカル→サーバー)。復元後の和集合(全 logs)を冪等 PUT。
  //    以前に送信できなかった記録もここでまとめて再送される。
  let backedUp = false;
  try {
    const result = await backupCareLogs(loadCareState().logs);
    backedUp = !result.skipped && result.total > 0 && result.failed === 0;
  } catch {
    // バックアップ失敗も握る。次トリガーで再送。
  }

  return { skipped: false, restoredCount, backedUp };
}
