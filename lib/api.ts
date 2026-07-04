import "@/lib/amplify";
import { fetchAuthSession, getCurrentUser } from "@aws-amplify/auth";
import type { CareLog } from "@/lib/types";

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
    const items = (await response.json()) as CareLog[];
    return items;
  } catch {
    return [];
  }
}
