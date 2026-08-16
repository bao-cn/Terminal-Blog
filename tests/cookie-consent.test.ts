import { describe, expect, it } from "vitest";
import {
  isCookieConsentCancelShortcut,
  parseCookieConsentInput,
  parseStoredCookieConsent,
} from "../lib/cookie-consent";

describe("cookie consent", () => {
  it("parses terminal consent input", () => {
    expect(parseCookieConsentInput("Y")).toBe("accepted");
    expect(parseCookieConsentInput(" yes ")).toBe("accepted");
    expect(parseCookieConsentInput("n")).toBe("declined");
    expect(parseCookieConsentInput("later")).toBeNull();
  });

  it("reads current and legacy stored values", () => {
    expect(parseStoredCookieConsent("accepted")).toBe("accepted");
    expect(parseStoredCookieConsent("declined")).toBe("declined");
    expect(parseStoredCookieConsent("true")).toBe("accepted");
    expect(parseStoredCookieConsent("false")).toBe("declined");
    expect(parseStoredCookieConsent(null)).toBeNull();
  });

  it("reserves Ctrl+C for cancelling the prompt", () => {
    expect(isCookieConsentCancelShortcut("c", true, false)).toBe(true);
    expect(isCookieConsentCancelShortcut("C", true, false)).toBe(true);
    expect(isCookieConsentCancelShortcut("c", true, true)).toBe(false);
    expect(isCookieConsentCancelShortcut("c", false, false)).toBe(false);
  });
});
