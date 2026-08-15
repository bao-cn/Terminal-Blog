import { describe, expect, it } from "vitest";
import { assertSameOrigin, readJsonBody, RequestSecurityError } from "../lib/request-security";

describe("request security", () => {
  it("parses bounded JSON requests", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(request, 1024)).resolves.toEqual({ ok: true });
  });

  it("rejects unsupported content types", async () => {
    const request = new Request("http://localhost/api", { method: "POST", body: "{}" });
    await expect(readJsonBody(request, 1024)).rejects.toMatchObject({ status: 415 });
  });

  it("rejects chunked bodies after the configured byte limit", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(128) }),
    });
    await expect(readJsonBody(request, 32)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects cross-origin mutations", () => {
    const request = new Request("https://terminal.example/api", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
    });
    expect(() => assertSameOrigin(request)).toThrowError(RequestSecurityError);
    try {
      assertSameOrigin(request);
    } catch (error) {
      expect(error).toMatchObject({ status: 403 });
    }
  });
});
