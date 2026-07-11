import type { CareLog } from "@/lib/types";
import { sanitizeLog } from "@/lib/storage";

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
