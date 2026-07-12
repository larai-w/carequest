// lib/__tests__/contacts.test.ts
//
// T46: 相談窓口情報の一元管理テスト
//
// CI が陳腐化を機械検知するための3種の検証:
//   1. lastVerified が 180 日以内(陳腐化アラート)
//   2. 電話番号の形式(存在する場合は 0120-XXX-XXX 等)
//   3. href が https であること

import { describe, it, expect } from "vitest";
import { supportContacts } from "@/lib/contacts";

// ---- 定数 ----
const MAX_VERIFIED_AGE_DAYS = 180;

// ---- ヘルパー ----

/** YYYY-MM-DD 文字列を Date に変換。不正な場合は Invalid Date を返す */
function parseISODate(dateStr: string): Date {
  // Date コンストラクタは YYYY-MM-DD を UTC で解釈するが
  // ここでは日数差の比較だけなのでタイムゾーンは問題にならない
  return new Date(dateStr);
}

/** 今日の日付文字列(YYYY-MM-DD)を返す(UTC 基準でテスト一貫性を確保) */
function todayISOString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 2つの YYYY-MM-DD 文字列の差を日数で返す(a が b より何日古いか) */
function daysBetween(olderStr: string, newerStr: string): number {
  const older = parseISODate(olderStr).getTime();
  const newer = parseISODate(newerStr).getTime();
  return Math.floor((newer - older) / (1000 * 60 * 60 * 24));
}

// ---- テスト ----

describe("supportContacts — データ完全性", () => {
  it("窓口が1件以上登録されている", () => {
    expect(supportContacts.length).toBeGreaterThan(0);
  });

  it("各窓口に name と detail が存在する", () => {
    for (const contact of supportContacts) {
      expect(contact.name, `name が空: ${JSON.stringify(contact)}`).toBeTruthy();
      expect(contact.detail, `detail が空: ${contact.name}`).toBeTruthy();
    }
  });
});

describe("supportContacts — lastVerified の陳腐化チェック(180 日以内)", () => {
  const today = todayISOString();

  it.each(supportContacts)(
    "%s の lastVerified が有効な YYYY-MM-DD であること",
    (contact) => {
      const d = parseISODate(contact.lastVerified);
      expect(
        isNaN(d.getTime()),
        `${contact.name} の lastVerified "${contact.lastVerified}" は有効な日付ではありません`,
      ).toBe(false);
      // YYYY-MM-DD 形式の正規表現チェック
      expect(
        contact.lastVerified,
        `${contact.name} の lastVerified は YYYY-MM-DD 形式である必要があります`,
      ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );

  it.each(supportContacts)(
    "%s の lastVerified が今日以前(未来日付でない)であること",
    (contact) => {
      expect(
        contact.lastVerified <= today,
        `${contact.name} の lastVerified "${contact.lastVerified}" が未来の日付です`,
      ).toBe(true);
    },
  );

  it.each(supportContacts)(
    `%s の lastVerified が ${MAX_VERIFIED_AGE_DAYS} 日以内であること`,
    (contact) => {
      const age = daysBetween(contact.lastVerified, today);
      expect(
        age,
        `${contact.name} の lastVerified "${contact.lastVerified}" は ${age} 日前です。` +
          `公式サイトで情報を確認し、lib/contacts.ts の lastVerified を今日の日付に更新してください。`,
      ).toBeLessThanOrEqual(MAX_VERIFIED_AGE_DAYS);
    },
  );
});

describe("supportContacts — 電話番号の形式", () => {
  // 許容する電話番号フォーマット:
  //   フリーダイヤル: 0120-XXX-XXX
  //   一般市外局番:   0XX-XXXX-XXXX や 0X-XXXX-XXXX
  const phonePattern = /^0\d{1,4}-\d{2,4}-\d{3,4}$/;

  const contactsWithPhone = supportContacts.filter((c) => c.phone !== undefined);

  it("電話番号を持つ窓口が1件以上ある", () => {
    expect(contactsWithPhone.length).toBeGreaterThan(0);
  });

  it.each(contactsWithPhone)(
    "%s の phone がハイフン区切り形式(0XXX-XXX-XXX 等)であること",
    (contact) => {
      expect(
        contact.phone!,
        `${contact.name} の phone "${contact.phone}" が想定フォーマットと一致しません`,
      ).toMatch(phonePattern);
    },
  );
});

describe("supportContacts — 出典 URL の検証", () => {
  const contactsWithHref = supportContacts.filter((c) => c.href !== null);

  it.each(contactsWithHref)(
    "%s の href が https:// で始まること",
    (contact) => {
      expect(
        contact.href!,
        `${contact.name} の href "${contact.href}" は https である必要があります`,
      ).toMatch(/^https:\/\//);
    },
  );

  it.each(contactsWithHref)(
    "%s の href が有効な URL であること",
    (contact) => {
      let url: URL | null = null;
      try {
        url = new URL(contact.href!);
      } catch {
        // URL のコンストラクタが throw したら不正
      }
      expect(
        url,
        `${contact.name} の href "${contact.href}" は有効な URL ではありません`,
      ).not.toBeNull();
    },
  );
});
