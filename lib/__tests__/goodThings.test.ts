import { describe, it, expect } from "vitest";
import { getTodayGoodThings, setTodayGoodThings } from "@/app/reflection/page";

// T39: 「今日のよかったこと」の日付紐づけロジックのユニットテスト。
// getTodayGoodThings / setTodayGoodThings は pure function なので DOM 不要で検証できる。

describe("getTodayGoodThings", () => {
  it("当日のエントリが存在する場合、その items を返す", () => {
    const history = [
      { date: "2024-03-14", items: ["昨日のよかったこと"] },
      { date: "2024-03-15", items: ["小さな介護ができた", "自分の休憩ができた"] },
    ];
    expect(getTodayGoodThings(history, "2024-03-15")).toEqual(["小さな介護ができた", "自分の休憩ができた"]);
  });

  it("当日のエントリが存在しない場合、空配列を返す(翌日はまっさら)", () => {
    const history = [
      { date: "2024-03-14", items: ["昨日のよかったこと"] },
    ];
    // 2024-03-15 のエントリはない → 空配列(前日のデータは出てこない)
    expect(getTodayGoodThings(history, "2024-03-15")).toEqual([]);
  });

  it("履歴が空の場合も空配列を返す", () => {
    expect(getTodayGoodThings([], "2024-03-15")).toEqual([]);
  });

  it("返り値を変更しても元の履歴が変わらない(コピーを返す)", () => {
    const history = [{ date: "2024-03-15", items: ["item1"] }];
    const result = getTodayGoodThings(history, "2024-03-15");
    result.push("追加");
    expect(history[0].items).toEqual(["item1"]);
  });
});

describe("setTodayGoodThings", () => {
  it("今日のエントリが存在しない場合、新しく追加する", () => {
    const history = [{ date: "2024-03-14", items: ["昨日"] }];
    const result = setTodayGoodThings(history, "2024-03-15", ["新しいよかったこと"]);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.date === "2024-03-15")!.items).toEqual(["新しいよかったこと"]);
    // 既存の日も残る
    expect(result.find((g) => g.date === "2024-03-14")!.items).toEqual(["昨日"]);
  });

  it("今日のエントリが存在する場合、上書きする(重複しない)", () => {
    const history = [{ date: "2024-03-15", items: ["古いデータ"] }];
    const result = setTodayGoodThings(history, "2024-03-15", ["更新後"]);
    // 1件のみ
    expect(result).toHaveLength(1);
    expect(result[0].items).toEqual(["更新後"]);
  });

  it("items が空配列になった日のエントリは削除する(空エントリを溜めない)", () => {
    const history = [
      { date: "2024-03-14", items: ["昨日"] },
      { date: "2024-03-15", items: ["今日のよかったこと"] },
    ];
    const result = setTodayGoodThings(history, "2024-03-15", []);
    // 2024-03-15 のエントリが削除される
    expect(result).toHaveLength(1);
    expect(result.find((g) => g.date === "2024-03-15")).toBeUndefined();
    // 別の日は残る
    expect(result.find((g) => g.date === "2024-03-14")).toBeDefined();
  });

  it("同日に何度もトグルしても履歴が重複しない", () => {
    let history: { date: string; items: string[] }[] = [];
    history = setTodayGoodThings(history, "2024-03-15", ["item1"]);
    history = setTodayGoodThings(history, "2024-03-15", ["item1", "item2"]);
    history = setTodayGoodThings(history, "2024-03-15", ["item2"]);
    // 常に 1 エントリのみ
    expect(history.filter((g) => g.date === "2024-03-15")).toHaveLength(1);
    expect(history.find((g) => g.date === "2024-03-15")!.items).toEqual(["item2"]);
  });

  it("元の配列を変更せず、新しい配列を返す(immutable)", () => {
    const original = [{ date: "2024-03-15", items: ["original"] }];
    const result = setTodayGoodThings(original, "2024-03-15", ["changed"]);
    // 元のオブジェクトは変わらない
    expect(original[0].items).toEqual(["original"]);
    expect(result[0].items).toEqual(["changed"]);
  });
});
