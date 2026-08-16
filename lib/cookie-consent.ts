export const COOKIE_CONSENT_STORAGE_KEY = "terminal-blog-cookie-consent-v1";

export type CookieConsent = "accepted" | "declined";

export function parseStoredCookieConsent(value: string | null): CookieConsent | null {
  if (value === "accepted" || value === "true") return "accepted";
  if (value === "declined" || value === "false") return "declined";
  return null;
}

export function parseCookieConsentInput(value: string): CookieConsent | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "y" || normalized === "yes") return "accepted";
  if (normalized === "n" || normalized === "no") return "declined";
  return null;
}

export function isCookieConsentCancelShortcut(key: string, ctrlKey: boolean, shiftKey: boolean) {
  return ctrlKey && !shiftKey && key.toLowerCase() === "c";
}
