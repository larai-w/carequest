import "@/lib/amplify";
import { fetchAuthSession, getCurrentUser } from "@aws-amplify/auth";
import type { CareLog } from "@/lib/types";
import { sanitizeLog } from "@/lib/storage";

const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const entriesEndpoint = apiBase ? `${apiBase}/entries` : "";

/**
 * サインイン状態を判定するヘルパー。
 *
 * fetchAuthSession でトークンを取得できた場合のみ true を返す。
 * 例外が発生した場合や、トークンが存在しない場合は false(未サインイン扱い)を返す。
 * これにより、セッション切れ・オフライン・Cognito 未設定のいずれでも安全側に倒れる。
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    return !!session.tokens?.idToken;
  } catch {
    // 例外時(ネットワーク障害・設定なし・セッション切れ)は未サインイン扱い
    return false;
  }
}

async function getCurrentUserId(): Promise<string> {
  try {
    const user = await getCurrentUser();
    const currentUser = user as { username?: string; attributes?: { email?: string } };
    return currentUser.username ?? currentUser.attributes?.email ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
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
