import { describe, expect, it } from "vitest";
import { authorized, hashToken, makeToken, validToken } from "../src/index";

describe("Eyaelo internal voucher primitives", () => {
  it("generates tokens in the required lab-only format", () => {
    const token = makeToken();
    expect(token).toMatch(/^EYA-(?:[0-9A-F]{5}-){7}[0-9A-F]{5}$/);
  });

  it("generates distinct tokens across repeated samples", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => makeToken()));
    expect(tokens.size).toBe(100);
  });

  it("normalizes valid tokens but rejects malformed input", () => {
    const token = makeToken();
    expect(validToken(token.toLowerCase())).toBe(token);
    expect(validToken(" EYA-123 ")).toBeNull();
    expect(validToken(null)).toBeNull();
    expect(validToken({ token: "anything" })).toBeNull();
  });

  it("hashes the same token deterministically without returning the token", async () => {
    const token = makeToken();
    const first = await hashToken(token);
    expect(await hashToken(token)).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(token);
  });

  it("requires the configured bearer token", async () => {
    const request = (authorization?: string) => new Request("https://lab.invalid/api/vouchers/issue", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : undefined,
    });
    expect(await authorized(request("Bearer test-secret"), { ADMIN_API_TOKEN: "test-secret" })).toBe(true);
    expect(await authorized(request("Bearer wrong-secret"), { ADMIN_API_TOKEN: "test-secret" })).toBe(false);
    expect(await authorized(request(), { ADMIN_API_TOKEN: "test-secret" })).toBe(false);
    expect(await authorized(request("Bearer test-secret"), {})).toBe(false);
    expect(await authorized(request("Basic test-secret"), { ADMIN_API_TOKEN: "test-secret" })).toBe(false);
  });
});
