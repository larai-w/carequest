import "@/lib/amplify";
import { fetchAuthSession, getCurrentUser } from "@aws-amplify/auth";
import type { CareLog } from "@/lib/types";
import { sanitizeLog } from "@/lib/storage";

const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const entriesEndpoint = apiBase ? `${apiBase}/entries` : "";

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

export async function syncCareLog(log: CareLog): Promise<boolean> {
  if (!entriesEndpoint) {
    return false;
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
    return response.ok;
  } catch {
    return false;
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
