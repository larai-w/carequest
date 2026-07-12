import type { CareLog } from "@/lib/types";
import { sanitizeLog } from "@/lib/storage";
import { chunk } from "@/lib/backup";

const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const entriesEndpoint = apiBase ? `${apiBase}/entries` : "";

// 「サインイン済みかもしれない」ことを示す軽量フラグの localStorage キー。
// このフラグは amplify を読み込まずに未サインインを即断するための一次判定に使う。
// サインイン成功時に立て、サインアウト時・実セッション不整合時に除去する。
export const SIGNED_IN_FLAG_KEY = "carequest-signed-in-v1";

/**
 * 軽量サインインフラグを立てる/下ろす(AuthPanel から呼ぶ)。
 * localStorage が使えない環境では静かに無視する(認証は安全側に倒れる)。
 */
export function setSignedInFlag(value: boolean): void {
  try {
    if (value) {
      window.localStorage.setItem(SIGNED_IN_FLAG_KEY, "1");
    } else {
      window.localStorage.removeItem(SIGNED_IN_FLAG_KEY);
    }
  } catch {
    // localStorage 不可(プライベートモード等)。フラグを残せなくても安全側=未サインイン。
  }
}

/**
 * 軽量フラグの有無を返す(amplify を読み込まない一次判定)。
 * フラグがなければ「確実に未サインイン」とみなせる。
 */
function hasSignedInFlag(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_IN_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * サインイン状態を判定するヘルパー(二段判定)。
 *
 * 第一段: 軽量フラグを見る。フラグがなければ amplify を一切読み込まず即 false。
 *   → 認証しない大多数のユーザーは認証 SDK をダウンロードしない(T45 の要)。
 * 第二段: フラグがある場合のみ amplify を動的 import し、実セッションを確認する。
 *   fetchAuthSession でトークンを取得できた場合のみ true。
 *
 * フラグは立っているが実セッションが無い/例外(セッション切れ・オフライン・
 * 設定なし)の場合は false を返し、同時に矛盾したフラグを除去して安全側=未サインインへ倒す。
 */
export async function isSignedIn(): Promise<boolean> {
  // 第一段: フラグなし → amplify を読まずに未サインイン確定
  if (!hasSignedInFlag()) {
    return false;
  }

  // 第二段: フラグあり → amplify を読み込んで実セッションを検証
  try {
    const { ensureAmplifyConfigured } = await import("@/lib/amplify");
    await ensureAmplifyConfigured();
    const { fetchAuthSession } = await import("@aws-amplify/auth");
    const session = await fetchAuthSession({ forceRefresh: false });
    if (session.tokens?.idToken) {
      return true;
    }
    // フラグはあるが実セッションが無い → 不整合。安全側に倒し、フラグも掃除する。
    setSignedInFlag(false);
    return false;
  } catch {
    // 例外時(ネットワーク障害・設定なし・セッション切れ)は未サインイン扱い。
    // フラグと実態がずれているので掃除する。
    setSignedInFlag(false);
    return false;
  }
}

async function getCurrentUserId(): Promise<string> {
  try {
    const { ensureAmplifyConfigured } = await import("@/lib/amplify");
    await ensureAmplifyConfigured();
    const { getCurrentUser } = await import("@aws-amplify/auth");
    const user = await getCurrentUser();
    const currentUser = user as { username?: string; attributes?: { email?: string } };
    return currentUser.username ?? currentUser.attributes?.email ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { ensureAmplifyConfigured } = await import("@/lib/amplify");
    await ensureAmplifyConfigured();
    const { fetchAuthSession } = await import("@aws-amplify/auth");
    const session = await fetchAuthSession({ forceRefresh: false });
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      };
    }
  } catch {
    // 認証トークンが取れなければ、通常のリクエストを行います。
  }
  return { "Content-Type": "application/json" };
}

export type SyncResult =
  | { skipped: true }            // 未サインイン — 同期不要、ローカル保存で完結
  | { skipped: false; ok: true }  // サインイン済み、同期成功
  | { skipped: false; ok: false }; // サインイン済み、同期失敗

/**
 * ケアログをクラウドに同期する。
 *
 * 未サインイン時は API を呼ばず { skipped: true } を返す(正常状態)。
 * 未サインイン判定は isSignedIn の二段判定に委ねるため、フラグが無ければ
 * amplify を読み込まずにスキップできる。
 * サインイン済みで同期に失敗した場合は { skipped: false, ok: false } を返す。
 */
export async function syncCareLog(log: CareLog): Promise<SyncResult> {
  // 未サインイン: API 呼び出しをスキップ(ローカル保存のみで完結が正常状態)
  if (!(await isSignedIn())) {
    return { skipped: true };
  }

  if (!entriesEndpoint) {
    return { skipped: false, ok: false };
  }

  const body = {
    userId: await getCurrentUserId(),
    ...log,
  };

  try {
    const response = await fetch(entriesEndpoint, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return { skipped: false, ok: response.ok };
  } catch {
    return { skipped: false, ok: false };
  }
}

export async function fetchCareEntries(): Promise<CareLog[]> {
  if (!entriesEndpoint) {
    return [];
  }

  try {
    const response = await fetch(entriesEndpoint, {
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      return [];
    }
    const raw: unknown = await response.json();
    // 生 JSON を信用しない: 配列でなければ空配列に落とし、
    // 各要素を sanitizeLog で検証して不正な要素は静かに除外する。
    if (!Array.isArray(raw)) {
      return [];
    }
    const items: CareLog[] = [];
    for (const entry of raw) {
      const log = sanitizeLog(entry);
      if (log) {
        items.push(log);
      }
    }
    return items;
  } catch {
    return [];
  }
}

export type BackupResult =
  | { skipped: true } // 未サインイン — バックアップ不要、ローカル保存で完結
  | { skipped: false; total: number; succeeded: number; failed: number };

// バックアップ送信のチャンク設定。API スロットリング(T29: 10rps / バースト 20)を
// 超えないよう、小さめのチャンクを送ってからチャンク間に短い間隔を置く。
const BACKUP_CHUNK_SIZE = 5;
const BACKUP_CHUNK_PAUSE_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ローカルの全 logs をクラウドへ冪等 PUT でバックアップする(手動・Phase A)。
 *
 * - 未サインインなら { skipped: true }(ローカル保存で完結が正常状態)。
 * - sk = log.id の冪等 PUT(T27)なので、全件送っても重複行にならない。
 *   差分最適化は不要で、まず全件送る安全側の実装。
 * - API スロットリング(T29)を超えないよう小さめチャンク + チャンク間の間隔で送る
 *   (design-sync.md §6 E-3)。
 * - 失敗しても記録はローカルに残る。呼び出し側は succeeded/failed で穏やかに通知する。
 */
export async function backupCareLogs(logs: CareLog[]): Promise<BackupResult> {
  if (!(await isSignedIn())) {
    return { skipped: true };
  }
  if (logs.length === 0) {
    return { skipped: false, total: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  const batches = chunk(logs, BACKUP_CHUNK_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const results = await Promise.all(batches[i].map((log) => syncCareLog(log)));
    for (const result of results) {
      if (!result.skipped && result.ok) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }
    // 最後のチャンク以外は、レート内に収めるため少し待つ。
    if (i < batches.length - 1) {
      await delay(BACKUP_CHUNK_PAUSE_MS);
    }
  }
  return { skipped: false, total: logs.length, succeeded, failed };
}

/**
 * クラウド(サーバー)に保存した自分の記録をすべて削除する(US-503)。
 * サーバー側で pk = userId(トークン由来)に固定して削除するので、他人のデータは消えない。
 * **ローカル(localStorage)の記録には一切触れない** — 端末の記録は本人のものとして残す。
 */
export async function deleteCloudEntries(): Promise<{ ok: boolean; deleted?: number }> {
  if (!(await isSignedIn())) {
    return { ok: false };
  }
  if (!entriesEndpoint) {
    return { ok: false };
  }
  try {
    const response = await fetch(entriesEndpoint, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      return { ok: false };
    }
    const raw: unknown = await response.json().catch(() => ({}));
    const deleted =
      typeof raw === "object" && raw !== null && typeof (raw as { deleted?: unknown }).deleted === "number"
        ? (raw as { deleted: number }).deleted
        : undefined;
    return { ok: true, deleted };
  } catch {
    return { ok: false };
  }
}

/**
 * アカウントを削除する(US-503 / design-sync E-6)。
 * 1. 先にクラウドの記録を削除する(アカウント削除後は sub が変わり孤児データになるため)。
 *    データ削除に失敗したら、孤児 PII を残さないためアカウント削除には進まない。
 * 2. Cognito のユーザー自身を削除(deleteUser)。
 * **ローカルの記録は削除しない** — 端末の記録は本人の手元に残す。
 */
export async function deleteAccount(): Promise<{ ok: boolean }> {
  const del = await deleteCloudEntries();
  if (!del.ok) {
    return { ok: false };
  }
  try {
    const { ensureAmplifyConfigured } = await import("@/lib/amplify");
    await ensureAmplifyConfigured();
    const { deleteUser } = await import("@aws-amplify/auth");
    await deleteUser();
    setSignedInFlag(false);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
