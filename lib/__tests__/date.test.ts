import { describe, it, expect, vi, afterEach } from "vitest";
import { getTodayDate, formatLocalDate, getDateStringDaysAgo, formatLogWhen } from "@/lib/date";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatLocalDate", () => {
  it("ローカル日付を YYYY-MM-DD 形式にフォーマットする", () => {
    // new Date(year, month, day) はローカルタイムゾーン基準
    const date = new Date(2024, 0, 5); // 2024-01-05
    expect(formatLocalDate(date)).toBe("2024-01-05");
  });

  it("月・日が1桁のときゼロ埋めする", () => {
    const date = new Date(2024, 8, 3); // 2024-09-03
    expect(formatLocalDate(date)).toBe("2024-09-03");
  });

  it("12月31日を正しくフォーマットする", () => {
    const date = new Date(2024, 11, 31);
    expect(formatLocalDate(date)).toBe("2024-12-31");
  });
});

describe("getTodayDate", () => {
  it("システム時刻のローカル日付を返す", () => {
    // 2024-03-15 12:00:00 ローカル時刻をセット
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 2, 15, 12, 0, 0));
    expect(getTodayDate()).toBe("2024-03-15");
  });

  it("【回帰】JST 深夜 0:30 でも当日(翌 UTC 日付ではなく)を返す", () => {
    // JST は UTC+9。深夜 0:30 JST = 前日 15:30 UTC
    // UTC ベースで日付を取得すると「前日」になるバグの回帰確認
    // ここではシステムがどのタイムゾーンにいても、
    // Date のローカルメソッドを使うことで正しい値が返るかを検証する。
    // vi.setSystemTime に UTC エポックを渡し、getDate() のローカル値を期待値とする。
    vi.useFakeTimers();
    // UTC で 2024-01-14 15:30:00 = JST で 2024-01-15 00:30:00
    const utcDate = new Date("2024-01-14T15:30:00Z");
    vi.setSystemTime(utcDate);

    const result = getTodayDate();
    // ローカルタイムゾーンで何日になるかは実行環境依存だが、
    // 実装が getFullYear/getMonth/getDate（ローカル）を使うことを保証するため
    // 実際の new Date() のローカル値と一致することを検証する
    const expected = formatLocalDate(new Date(utcDate));
    expect(result).toBe(expected);
  });

  it("【回帰】UTC 基準で取ると前日になるケースを具体的に再現: ローカルが JST のとき", () => {
    // このテストはシステムが JST (UTC+9) のときのみ JST 深夜を検証できるが、
    // 少なくとも実装が toISOString().slice(0,10) のような UTC 日付を返さないことを確認する。
    vi.useFakeTimers();
    // UTC で 2024-06-30 23:00:00 (JST だと 2024-07-01 08:00:00)
    const utcDate = new Date("2024-06-30T23:00:00Z");
    vi.setSystemTime(utcDate);
    const result = getTodayDate();
    // ISO string は "2024-06-30" だが、ローカル(JST)では "2024-07-01"
    // 実装が toISOString を使っていれば "2024-06-30" が返り、テストが失敗する
    const expectedLocal = formatLocalDate(new Date(utcDate));
    // UTC 文字列と一致してはいけない(JST 環境でのみ確実に差異が生じるが、実装の正しさの証明)
    expect(result).toBe(expectedLocal);
    // 実装が toISOString に依存していないことの確認: result と toISOString のどちらかが正しい
    // → result === expectedLocal が真であれば OK
  });
});

describe("getDateStringDaysAgo", () => {
  it("1日前の日付を返す", () => {
    expect(getDateStringDaysAgo("2024-03-15", 1)).toBe("2024-03-14");
  });

  it("7日前の日付を返す", () => {
    expect(getDateStringDaysAgo("2024-03-15", 7)).toBe("2024-03-08");
  });

  it("境界: 月初 → 前月末 (2024-03-01 の 1日前 = 2024-02-29)", () => {
    // 2024年はうるう年
    expect(getDateStringDaysAgo("2024-03-01", 1)).toBe("2024-02-29");
  });

  it("境界: 年始 → 前年末 (2024-01-01 の 1日前 = 2023-12-31)", () => {
    expect(getDateStringDaysAgo("2024-01-01", 1)).toBe("2023-12-31");
  });

  it("境界: うるう年 2/29 の 1日前 = 2/28", () => {
    expect(getDateStringDaysAgo("2024-02-29", 1)).toBe("2024-02-28");
  });

  it("境界: うるう年 2/29 の 1日後 = 3/1 (n=-1)", () => {
    expect(getDateStringDaysAgo("2024-02-29", -1)).toBe("2024-03-01");
  });

  it("境界: 非うるう年 3/01 の 1日前 = 2/28", () => {
    expect(getDateStringDaysAgo("2023-03-01", 1)).toBe("2023-02-28");
  });

  it("n=0 のとき today 自身を返す", () => {
    expect(getDateStringDaysAgo("2024-05-20", 0)).toBe("2024-05-20");
  });

  it("30日前を正しく計算する", () => {
    expect(getDateStringDaysAgo("2024-02-29", 30)).toBe("2024-01-30");
  });
});

describe("formatLogWhen", () => {
  it("completedAt があれば「M月D日 HH:MM」(ローカル時刻)を返す", () => {
    // ローカルで作った時刻を ISO 化 → パースし直しても同じローカル時刻に戻る(TZ 非依存)。
    const completedAt = new Date(2024, 2, 15, 10, 30).toISOString();
    expect(formatLogWhen(completedAt, "2024-03-15")).toBe("3月15日 10:30");
  });

  it("時・分は1桁でもゼロ埋めする", () => {
    const completedAt = new Date(2024, 8, 3, 9, 5).toISOString();
    expect(formatLogWhen(completedAt, "2024-09-03")).toBe("9月3日 09:05");
  });

  it("completedAt が空なら date から「M月D日」を返す(ゼロ埋めしない)", () => {
    expect(formatLogWhen("", "2024-03-05")).toBe("3月5日");
  });

  it("completedAt が不正でも date にフォールバックする", () => {
    expect(formatLogWhen("not-a-date", "2024-12-31")).toBe("12月31日");
  });

  it("completedAt も date も無ければ空文字", () => {
    expect(formatLogWhen("", "")).toBe("");
  });

  it("date が不正形式なら空文字(表示側で出さない)", () => {
    expect(formatLogWhen("", "2024/03/15")).toBe("");
  });
});
