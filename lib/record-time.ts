// BEN-004: 記録時間測定クライアント (PM-02)
//
// 介護ケア記録プログラム「記録時間 < 10秒」を実測するためのフロントエンド計測。
// 1回の記録操作(記録開始→保存完了)にかかった時間(ms)を、サインイン済みユーザー
// だけバックエンドに送る。未サインインのユーザーからは一切送らない(匿名性・負荷両面)。
//
// 設計方針:
// - 計測は記録フローの邪魔をしない。送信失敗しても記録本体には影響しない(fire & forget)。
// - 認証は lib/api.ts の isSignedIn / getAuthHeaders と同じ二段判定パターンを使う。
//   未サインインなら amplify を読み込まず即スキップ(T45 の初期バンドル最適化を維持)。
// - 送信するのは durationMs と step(どの画面/経路の記録か)だけ。記録内容・個人識別子は送らない。

import { isSignedIn } from "@/lib/api";

const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const recordTimeEndpoint = apiBase ? `${apiBase}/record-time` : "";

// 記録経路の識別子。どのUIフローの記録時間を測っているかのラベル。
// 個人を特定する情報ではなく、集計時のセグメント用。
export type RecordStep = "quick" | "full" | "edit";

// 計測結果の妥当性ガード。負値・異常値(10分超)は計測ミスとみなして送らない。
const MIN_DURATION_MS = 0;
const MAX_DURATION_MS = 10 * 60 * 1000;

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
    // トークンが取れなければ認証なし扱い → 送信スキップ
  }
  return { "Content-Type": "application/json" };
}

/**
 * 1回の記録操作にかかった時間をバックエンドに送信する。
 *
 * - 未サインインなら何もしない(戻り値 false)。記録はローカル完結が正常状態。
 * - 送信に失敗しても false を返すだけで、呼び出し側の記録フローには影響しない。
 * - durationMs が妥当範囲外なら送信しない(計測ミスのノイズ混入を防ぐ)。
 */
export async function sendRecordTime(
  durationMs: number,
  step: RecordStep = "quick",
): Promise<boolean> {
  if (!recordTimeEndpoint) {
    return false;
  }
  if (!Number.isFinite(durationMs)) {
    return false;
  }
  if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    return false;
  }
  if (!(await isSignedIn())) {
    return false;
  }

  try {
    const response = await fetch(recordTimeEndpoint, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        durationMs: Math.round(durationMs),
        step,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 記録操作の経過時間を計測する軽量トラッカー。
 *
 * 使い方:
 *   const tracker = createRecordTimeTracker();
 *   // ... 記録UIを開く ...
 *   await tracker.stop("quick"); // 保存完了時に呼ぶ。内部で sendRecordTime する。
 *
 * start() を呼ばずに stop() しても何も送らない(計測開始点が無いと無意味なため)。
 */
export function createRecordTimeTracker() {
  let startedAt: number | null = null;

  return {
    start(): void {
      startedAt =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    },
    async stop(step: RecordStep = "quick"): Promise<boolean> {
      if (startedAt === null) {
        return false;
      }
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const durationMs = now - startedAt;
      startedAt = null;
      return sendRecordTime(durationMs, step);
    },
  };
}