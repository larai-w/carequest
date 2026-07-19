import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendFeedback, MAX_FEEDBACK_NOTE_LENGTH } from "../feedback";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/dev/");
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sendFeedback", () => {
  it("mood を /feedback に POST し、成功で true を返す", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const result = await sendFeedback("good");
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/dev/feedback");
    expect(JSON.parse(init.body)).toEqual({ mood: "good" });
  });

  it("note は trim して送る。空白のみなら送らない", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await sendFeedback("okay", "  つかいやすいです  ");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      mood: "okay",
      note: "つかいやすいです",
    });

    await sendFeedback("okay", "   ");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ mood: "okay" });
  });

  it("note は上限文字数で切り詰める", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await sendFeedback("hard", "あ".repeat(MAX_FEEDBACK_NOTE_LENGTH + 100));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.note).toHaveLength(MAX_FEEDBACK_NOTE_LENGTH);
  });

  it("API URL 未設定なら fetch せず false", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const result = await sendFeedback("good");
    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetch 失敗・非 2xx は false(例外を投げない)", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await sendFeedback("good")).toBe(false);

    fetchMock.mockResolvedValue({ ok: false });
    expect(await sendFeedback("good")).toBe(false);
  });
});
