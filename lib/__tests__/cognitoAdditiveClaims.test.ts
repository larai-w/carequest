import { describe, it, expect, vi, beforeEach } from "vitest";
import { decodeJWT } from "@aws-amplify/core";
import { fetchAuthSession } from "@aws-amplify/auth";

// Cognito のトークンに acr(文字列)と amr(文字列の配列)が加わっても、
// フロントがトークンを読めて、そのまま API に送れることを確かめる
// (AWS のお知らせ: 2026-11-04 から。docs/cognito-additive-claims-2026-10.md)。
vi.mock("@/lib/amplify", () => ({
  ensureAmplifyConfigured: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: undefined }),
  getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")),
  deleteUser: vi.fn().mockResolvedValue(undefined),
}));

const SIGNED_IN_FLAG_KEY = "carequest-signed-in-v1";

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

// 署名は検証しない(検証は API Gateway の authorizer が行う)ため、架空の署名で足りる。
function fakeIdToken(extra: Record<string, unknown>): string {
  const payload = {
    sub: "sub-0001",
    "cognito:username": "user-additive",
    token_use: "id",
    exp: 1793754000,
    iat: 1793750400,
    ...extra,
  };
  return `${base64url({ alg: "RS256", kid: "example" })}.${base64url(payload)}.c2ln`;
}

describe("acr / amr が加わった ID トークン", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://example.com/api");
  });

  it("Amplify の decodeJWT が acr / amr を含むトークンを読める", () => {
    const token = fakeIdToken({ acr: "urn:example:acr", amr: ["pwd", "mfa"], future_claim: "x" });
    const decoded = decodeJWT(token);
    expect(decoded.payload.sub).toBe("sub-0001");
    expect(decoded.payload["cognito:username"]).toBe("user-additive");
    expect(decoded.payload.acr).toBe("urn:example:acr");
    expect(decoded.payload.amr).toEqual(["pwd", "mfa"]);
    expect(decoded.toString()).toBe(token);
  });

  it("API には同じトークンを Authorization: Bearer でそのまま送る", async () => {
    const token = fakeIdToken({ acr: "urn:example:acr", amr: ["pwd"] });
    const store = new Map([[SIGNED_IN_FLAG_KEY, "1"]]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    });
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: {
        idToken: decodeJWT(token),
        accessToken: undefined as unknown as NonNullable<Awaited<ReturnType<typeof fetchAuthSession>>["tokens"]>["accessToken"],
      },
      credentials: undefined,
      identityId: undefined,
      userSub: undefined,
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) });
    vi.stubGlobal("fetch", fetchSpy);

    const { fetchCareEntries } = await import("@/lib/api");
    await expect(fetchCareEntries()).resolves.toEqual([]);

    const init = fetchSpy.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
  });
});
