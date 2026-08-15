import { describe, expect, it } from "vitest";
import { sessionIsActive, type SessionRecord } from "../lib/auth-policy";

const now = 1_000_000;
const activeSession: SessionRecord = {
  created_at: now - 1000,
  expires_at: now + 1000,
  revoked_at: null,
  password_version: 3,
  current_password_version: 3,
};

describe("session policy", () => {
  it("accepts only current, unexpired sessions", () => {
    expect(sessionIsActive(activeSession, now)).toBe(true);
    expect(sessionIsActive({ ...activeSession, expires_at: now }, now)).toBe(false);
    expect(sessionIsActive({ ...activeSession, revoked_at: now - 1 }, now)).toBe(false);
    expect(sessionIsActive({ ...activeSession, current_password_version: 4 }, now)).toBe(false);
  });

  it("rejects sessions created beyond the allowed clock skew", () => {
    expect(sessionIsActive({ ...activeSession, created_at: now + 30_001 }, now)).toBe(false);
  });
});
