import type { SyncResult } from "@/lib/api";

// 端末で取り消した記録を、クラウドのバックアップからも消すための控え(2026-09-14 /hci-check 候補 #3)。
//
// 以前は取り消しても、バックアップ済みの記録がクラウドに残り続け、
// 「クラウドから復元」で取り消した記録が戻ってきていた。
//
// - 取り消した id をここに控え、消せたら外す。通信できないときは次の同期で消し直す。
// - 「元に戻す」で控えから外す(戻した記録を消しに行かない)。
// - 復元・サインイン同期では、控えにある記録をクラウドから戻さない。
// - 控えの読み書きに失敗しても、記録の操作そのものは止めない。

const PENDING_KEY = "carequest-pending-cloud-deletes-v1";

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    if (ids.length === 0) {
      window.localStorage.removeItem(PENDING_KEY);
    } else {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify(ids));
    }
  } catch {
    // 端末に控えられなくても、記録の取り消しは済んでいる。
  }
}

export function pendingCloudDeletes(): string[] {
  return read();
}

export function markDeletedForCloud(id: string): void {
  const ids = read();
  if (!ids.includes(id)) {
    write([...ids, id]);
  }
}

export function unmarkDeletedForCloud(id: string): void {
  const ids = read();
  if (ids.includes(id)) {
    write(ids.filter((existing) => existing !== id));
  }
}

export function withoutPendingDeletes<T extends { id: string }>(logs: T[]): T[] {
  const ids = new Set(read());
  return ids.size === 0 ? logs : logs.filter((log) => !ids.has(log.id));
}

export interface FlushResult {
  skipped: boolean;
  deleted: number;
  failed: number;
}

/**
 * 控えにある記録をクラウドから消す。消せたものだけ控えから外す。
 * 未サインインなら控えを残したまま何もしない。
 */
export async function flushPendingCloudDeletes(
  deleteOne: (id: string) => Promise<SyncResult>,
): Promise<FlushResult> {
  const ids = read();
  let deleted = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await deleteOne(id);
    if (result.skipped) {
      return { skipped: true, deleted, failed };
    }
    if (result.ok) {
      deleted += 1;
      // 途中で「元に戻す」されていても、外すだけなので問題ない。
      unmarkDeletedForCloud(id);
    } else {
      failed += 1;
    }
  }
  return { skipped: false, deleted, failed };
}
