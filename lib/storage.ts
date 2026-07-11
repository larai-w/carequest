import type { CareLog, CareTask, DailyEnergy, DailyGoodThings, EnergyLevel, User } from "@/lib/types";
import { getTodayDate } from "@/lib/date";

// 後方互換のため再エクスポート。新しい参照は lib/date.ts を直接使う。
export { getTodayDate };

const STORAGE_KEY = "carequest-state-v1";

// スキーマバージョン。保存データの構造を変えたら上げ、migration を追加する。
// このアプリでは localStorage が唯一の保存先なので、破損・旧構造でも
// 「健全なフィールドは必ず残す」ことを最優先にする。
export const CURRENT_SCHEMA_VERSION = 5;

export interface CareStorageState {
  user: User;
  logs: CareLog[];
  note: string;
  customTasks: CareTask[];
  // v3: エネルギーレベルの日別履歴。相談窓口の導線(US-502)に使う。
  energyHistory: DailyEnergy[];
  // v3: 相談窓口カードを最後に表示した日(YYYY-MM-DD)。空文字は未表示。
  //     表示を数日に1回までに絞るための throttle。
  supportNudgeLastShown: string;
  // v4: 初回オンボーディングカードを表示済みかどうか。
  //     localStorage の性質(端末内保存・アカウント不要・書き出し可能)を最初に一度だけ伝える。
  onboardingShown: boolean;
  // v5: 「今日のよかったこと」の日別履歴。
  //     date ごとにチェックした items を保持し、翌日は当日分がまっさらになる(当日のエントリが存在しない)。
  goodThingsHistory: DailyGoodThings[];
}

// 保存フォーマット。version を持つ以外は CareStorageState と同じ。
interface PersistedState extends CareStorageState {
  version: number;
}

export function createInitialUser(): User {
  return {
    id: "caregiver-1",
    name: "あなた",
    energyLevel: "normal",
    todayPoints: 0,
    lastActiveDate: getTodayDate(),
    reflectionNote: "",
    restMode: false,
    goodThings: [],
  };
}

function createInitialState(): CareStorageState {
  return {
    user: createInitialUser(),
    logs: [],
    note: "",
    customTasks: [],
    energyHistory: [],
    supportNudgeLastShown: "",
    onboardingShown: false,
    goodThingsHistory: [],
  };
}

// ---------------------------------------------------------------------------
// マイグレーション
// ---------------------------------------------------------------------------
// version が付いていない旧データ(v1)から現行(v2)まで、段階的な migration
// 関数チェーンで引き上げる。将来の構造変更は migrations に 1 関数追加するだけ。
// 各 migration は「その1つ前のバージョンの生データ」を受け取り、
// 「次のバージョンの生データ」を返す(検証はここではしない。sanitize が担う)。

type RawRecord = Record<string, unknown>;

const migrations: Record<number, (raw: RawRecord) => RawRecord> = {
  // v1(version フィールドなし)→ v2: version を付与するだけ。
  // 既存フィールドは温存し、破壊的変更はしない。
  1: (raw) => ({ ...raw, version: 2 }),
  // v2 → v3: エネルギー履歴と相談窓口カードの表示履歴フィールドを追加する。
  // 既存フィールドは温存。実際の値の検証は sanitize が担う。
  2: (raw) => ({
    energyHistory: [],
    supportNudgeLastShown: "",
    ...raw,
    version: 3,
  }),
  // v3 → v4: 初回オンボーディング表示済みフラグを追加する。
  // 既存ユーザーは既に使い始めているので true にして再表示しない。
  3: (raw) => ({
    onboardingShown: true,
    ...raw,
    version: 4,
  }),
  // v4 → v5: 「今日のよかったこと」の日別履歴フィールドを追加する。
  // 既存の user.goodThings は温存し、ここでは goodThingsHistory に変換しない。
  // 理由: 過去のどの日に選択したものかが分からないため、日付に紐づけることができない。
  //       user.goodThings への読み取りアクセス(import の goodThings 和集合マージ等)は
  //       引き続き機能する。新しい書き込みは goodThingsHistory にのみ行われる。
  4: (raw) => ({
    goodThingsHistory: [],
    ...raw,
    version: 5,
  }),
};

function detectVersion(raw: RawRecord): number {
  const v = raw.version;
  // version なし、または数値でないものはすべて最初期(v1)とみなす。
  if (typeof v === "number" && Number.isInteger(v) && v >= 1) {
    return v;
  }
  return 1;
}

function runMigrations(raw: RawRecord): RawRecord {
  let current = raw;
  let version = detectVersion(current);
  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      // migration が欠けている場合は無理に進めず、そのまま sanitize に委ねる。
      break;
    }
    current = migrate(current);
    version += 1;
  }
  return current;
}

// ---------------------------------------------------------------------------
// フィールド単位の検証・救済(sanitize)
// ---------------------------------------------------------------------------
// 壊れたフィールドだけをデフォルトに置換し、健全なフィールドは必ず残す。
// logs は要素ごとに検証して不正な要素だけを除外する(全捨てしない)。
// 救済が発生したら recovered = true にして呼び出し側へ知らせる。

const ENERGY_LEVELS: readonly EnergyLevel[] = ["low", "normal", "energetic"];

function isEnergyLevel(value: unknown): value is EnergyLevel {
  return typeof value === "string" && ENERGY_LEVELS.includes(value as EnergyLevel);
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface SanitizeResult {
  state: CareStorageState;
  recovered: boolean;
}

function sanitizeUser(value: unknown, report: { recovered: boolean }): User {
  const defaults = createInitialUser();
  if (!isRecord(value)) {
    // user 全体が壊れている場合のみ、ここで救済フラグを立てる。
    // (キー欠落だけの部分的な旧データは「健全」扱いにし、フラグは立てない)
    report.recovered = true;
    return defaults;
  }

  const user: User = { ...defaults };

  if (typeof value.id === "string") user.id = value.id;
  if (typeof value.name === "string") user.name = value.name;
  if (isEnergyLevel(value.energyLevel)) user.energyLevel = value.energyLevel;
  if (typeof value.todayPoints === "number" && Number.isFinite(value.todayPoints)) {
    user.todayPoints = value.todayPoints;
  }
  if (isDateString(value.lastActiveDate)) user.lastActiveDate = value.lastActiveDate;
  if (typeof value.reflectionNote === "string") user.reflectionNote = value.reflectionNote;
  if (typeof value.restMode === "boolean") user.restMode = value.restMode;
  if (Array.isArray(value.goodThings)) {
    user.goodThings = value.goodThings.filter((g): g is string => typeof g === "string");
  }

  return user;
}

export function sanitizeLog(value: unknown): CareLog | null {
  if (!isRecord(value)) return null;

  // points と date は「意味が壊れると記録が誤って見える」ため必須で厳格に検証する。
  if (typeof value.points !== "number" || !Number.isFinite(value.points)) return null;
  if (!isDateString(value.date)) return null;
  if (typeof value.id !== "string") return null;

  // その他の文字列フィールドは、欠けていても記録自体は救えるので補完する。
  return {
    id: value.id,
    taskId: typeof value.taskId === "string" ? value.taskId : "",
    title: typeof value.title === "string" ? value.title : "",
    points: value.points,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : "",
    date: value.date,
    energyLevel: isEnergyLevel(value.energyLevel) ? value.energyLevel : "normal",
  };
}

function sanitizeCustomTask(value: unknown): CareTask | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.points !== "number" || !Number.isFinite(value.points)) return null;

  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "",
    points: value.points,
    description: typeof value.description === "string" ? value.description : "",
  };
}

function sanitizeDailyEnergy(value: unknown): DailyEnergy | null {
  if (!isRecord(value)) return null;
  // date と energyLevel の両方が妥当でなければ、記録として意味を持たないので除外。
  if (!isDateString(value.date)) return null;
  if (!isEnergyLevel(value.energyLevel)) return null;
  return { date: value.date, energyLevel: value.energyLevel };
}

function sanitizeDailyGoodThings(value: unknown): DailyGoodThings | null {
  if (!isRecord(value)) return null;
  // date が不正であればエントリごと除外する(energyHistory と同じ方針)。
  if (!isDateString(value.date)) return null;
  // items が配列でなければエントリごと除外する。
  if (!Array.isArray(value.items)) return null;
  // items 内の非文字列要素だけを除外し、文字列のみ残す(要素単位の救済)。
  const items = value.items.filter((item): item is string => typeof item === "string");
  return { date: value.date, items };
}

function sanitizeState(raw: RawRecord): SanitizeResult {
  const report = { recovered: false };

  // logs: 配列でなければデフォルト([])に置換し救済フラグ。
  // 配列なら要素ごとに検証し、不正な要素「だけ」を除外する。
  const logs: CareLog[] = [];
  if (Array.isArray(raw.logs)) {
    for (const entry of raw.logs) {
      const log = sanitizeLog(entry);
      if (log) {
        logs.push(log);
      } else {
        report.recovered = true;
      }
    }
  } else if (raw.logs !== undefined) {
    // logs キーはあるが配列でない → 壊れている
    report.recovered = true;
  }

  // customTasks: logs と同じ方針。キーがない旧データは健全扱い。
  const customTasks: CareTask[] = [];
  if (Array.isArray(raw.customTasks)) {
    for (const entry of raw.customTasks) {
      const task = sanitizeCustomTask(entry);
      if (task) {
        customTasks.push(task);
      } else {
        report.recovered = true;
      }
    }
  } else if (raw.customTasks !== undefined) {
    report.recovered = true;
  }

  // note: 文字列でなければ空文字に救済。
  let note = "";
  if (typeof raw.note === "string") {
    note = raw.note;
  } else if (raw.note !== undefined) {
    report.recovered = true;
  }

  // energyHistory: logs と同じ方針。不正な要素だけ除外し、健全な日は残す。
  const energyHistory: DailyEnergy[] = [];
  if (Array.isArray(raw.energyHistory)) {
    for (const entry of raw.energyHistory) {
      const day = sanitizeDailyEnergy(entry);
      if (day) {
        energyHistory.push(day);
      } else {
        report.recovered = true;
      }
    }
  } else if (raw.energyHistory !== undefined) {
    report.recovered = true;
  }

  // supportNudgeLastShown: 日付文字列でなければ空文字("未表示")に救済。
  let supportNudgeLastShown = "";
  if (isDateString(raw.supportNudgeLastShown)) {
    supportNudgeLastShown = raw.supportNudgeLastShown;
  } else if (raw.supportNudgeLastShown !== undefined && raw.supportNudgeLastShown !== "") {
    report.recovered = true;
  }

  // onboardingShown: boolean でなければ false に救済(初回扱いにする)。
  // フィールドが存在しない旧データは migration で true に変換済みのはずだが、
  // sanitize で念のため boolean 以外を false に揃える。
  const onboardingShown = typeof raw.onboardingShown === "boolean" ? raw.onboardingShown : false;

  // goodThingsHistory: energyHistory と同じ方針。不正な要素だけ除外し、健全な日は残す。
  // date 不正・items 非配列・非文字列 items 要素の除外(要素単位の救済)。
  const goodThingsHistory: DailyGoodThings[] = [];
  if (Array.isArray(raw.goodThingsHistory)) {
    for (const entry of raw.goodThingsHistory) {
      const day = sanitizeDailyGoodThings(entry);
      if (day) {
        goodThingsHistory.push(day);
      } else {
        report.recovered = true;
      }
    }
  } else if (raw.goodThingsHistory !== undefined) {
    report.recovered = true;
  }

  const user = sanitizeUser(raw.user, report);

  return {
    state: { user, logs, note, customTasks, energyHistory, supportNudgeLastShown, onboardingShown, goodThingsHistory },
    recovered: report.recovered,
  };
}

// ---------------------------------------------------------------------------
// ロード
// ---------------------------------------------------------------------------

export interface LoadReport {
  state: CareStorageState;
  // 破損フィールドの置換・不正 log 要素の除外など「救済」が起きたら true。
  recovered: boolean;
}

/**
 * 救済が発生したかどうかも含めてロードする。
 * ホーム等で「整えて復元しました」を一度だけ知らせるために使う。
 */
export function loadCareStateWithReport(): LoadReport {
  if (typeof window === "undefined") {
    return { state: createInitialState(), recovered: false };
  }

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage 自体にアクセスできない(プライベートモード等)場合。
    // これは「保存データの破損」ではないので recovered は立てない。
    return { state: createInitialState(), recovered: false };
  }

  if (!raw) {
    return { state: createInitialState(), recovered: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON 全体が壊れているときだけ、初期状態への全落ちが避けられない。
    // 救済フラグを立てて、ユーザーには穏やかに知らせる。
    return { state: createInitialState(), recovered: true };
  }

  if (!isRecord(parsed)) {
    return { state: createInitialState(), recovered: true };
  }

  const migrated = runMigrations(parsed);
  return sanitizeState(migrated);
}

/**
 * 従来のシグネチャ・挙動を維持するロード。
 * 既存の呼び出し箇所はこれをそのまま使える。
 */
export function loadCareState(): CareStorageState {
  return loadCareStateWithReport().state;
}

/**
 * localStorage ではなく、外部から渡された生データ(インポートした JSON の
 * data 部分など)を、ロード時と同じ migration + sanitize パイプラインに通す。
 * 生 JSON を直接 saveCareState に渡すのを避け、壊れた・悪意ある要素の混入を
 * ここで必ず取り除くための入口。
 */
export function sanitizeRawState(raw: unknown): CareStorageState {
  if (!isRecord(raw)) {
    return createInitialState();
  }
  const migrated = runMigrations(raw);
  return sanitizeState(migrated).state;
}

// ---------------------------------------------------------------------------
// 保存
// ---------------------------------------------------------------------------

/**
 * 状態を localStorage に保存する。
 * 戻り値: 保存に成功したら true、失敗(容量超過・プライベートモード等)なら false。
 * 既存の呼び出し箇所が戻り値を無視しても動作は変わらない(後方互換)。
 */
export function saveCareState(state: CareStorageState): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    // 常に最新スキーマバージョンで保存する。
    // TODO: AWS へ移行する際は、この保存処理を API Gateway + Lambda + DynamoDB へ置き換えます。
    const persisted: PersistedState = { version: CURRENT_SCHEMA_VERSION, ...state };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    return true;
  } catch {
    // 保存に失敗しても画面は継続できるようにします。
    return false;
  }
}
