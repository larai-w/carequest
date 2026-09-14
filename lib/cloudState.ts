// クラウド控えまわりの、端末に残す小さな状態(2026-09-14 /hci-check「クラウド控え」)。
//
// - 端末の記録の持ち主(#1): 家族が同じ端末で別のアカウントにログインしたとき、
//   前の人の記録がその人のクラウドへ送られたり、クラウドの記録が混ざったりしないようにする。
//   アカウント名そのものは残さず、ハッシュだけを残す(次にこの端末を使う人に見えないように)。
// - 最後にクラウドへ控えた日時(#3): 「控えられています」と決めつけず、事実を見せる。
// - 自動で控えるのを止める(#4): クラウドの記録を削除した直後に、次の記録で全件が戻らないようにする。
// - ログインが切れた印(#6): 自動バックアップが黙って止まらないようにする。
//
// どれも localStorage が使えなくても例外を出さず、記録の操作を止めない。

const OWNER_KEY = "carequest-device-owner-v1";
const PAUSED_KEY = "carequest-cloud-auto-paused-v1";
const LAST_BACKUP_KEY = "carequest-last-cloud-backup-v1";
const SESSION_LOST_KEY = "carequest-session-lost-v1";
// 別のアカウントの記録があると分かった印(2026-09-14 /hci-check「直した後」#2)。
// ホームは認証 SDK を読まずに、この印だけで選ぶ欄を出す(T45)。
const OWNER_CONFLICT_KEY = "carequest-owner-conflict-v1";
// lib/cloudDeletes.ts の控えと同じキー。すべての記録を削除したら一緒に消す。
const PENDING_DELETES_KEY = "carequest-pending-cloud-deletes-v1";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 端末に残せなくても、記録の操作は止めない。
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 同上。
  }
}

async function fingerprint(userId: string): Promise<string> {
  const text = `carequest:${userId}`;
  try {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // crypto.subtle が使えない環境(安全でない接続など)。名前を残さないことだけは守る。
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `fnv1a-${hash.toString(16)}`;
  }
}

export type DeviceOwnerCheck = "ok" | "other-account";

/**
 * このアカウントが、端末の記録の持ち主かを確かめる。
 * まだ持ち主がいなければ、このアカウントを持ち主として覚える。
 */
export async function checkDeviceOwner(userId: string): Promise<DeviceOwnerCheck> {
  const mine = await fingerprint(userId);
  const current = read(OWNER_KEY);
  if (!current) {
    write(OWNER_KEY, mine);
    remove(OWNER_CONFLICT_KEY);
    return "ok";
  }
  if (current === mine) {
    remove(OWNER_CONFLICT_KEY);
    return "ok";
  }
  write(OWNER_CONFLICT_KEY, "1");
  return "other-account";
}

/** 本人が「この端末の記録を、このアカウントのクラウドへ送る」と選んだときだけ呼ぶ。 */
export async function adoptDeviceOwner(userId: string): Promise<void> {
  write(OWNER_KEY, await fingerprint(userId));
  remove(OWNER_CONFLICT_KEY);
}

export function hasOwnerConflict(): boolean {
  return read(OWNER_CONFLICT_KEY) === "1";
}

/** ログアウトしたときに呼ぶ。次にログインした人で、もう一度確かめる。 */
export function clearOwnerConflict(): void {
  remove(OWNER_CONFLICT_KEY);
}

export function getLastCloudBackupAt(): string | null {
  return read(LAST_BACKUP_KEY);
}

export function setLastCloudBackupAt(iso: string): void {
  write(LAST_BACKUP_KEY, iso);
}

export function clearLastCloudBackupAt(): void {
  remove(LAST_BACKUP_KEY);
}

export function isAutoBackupPaused(): boolean {
  return read(PAUSED_KEY) === "1";
}

export function pauseAutoBackup(): void {
  write(PAUSED_KEY, "1");
}

export function resumeAutoBackup(): void {
  remove(PAUSED_KEY);
}

export function hasSessionLost(): boolean {
  return read(SESSION_LOST_KEY) === "1";
}

export function markSessionLost(): void {
  write(SESSION_LOST_KEY, "1");
}

export function clearSessionLost(): void {
  remove(SESSION_LOST_KEY);
}

/** すべての記録を削除したとき・アカウントを削除したときに呼ぶ。 */
export function clearCloudState(): void {
  remove(OWNER_KEY);
  remove(PAUSED_KEY);
  remove(LAST_BACKUP_KEY);
  remove(PENDING_DELETES_KEY);
  remove(OWNER_CONFLICT_KEY);
}
