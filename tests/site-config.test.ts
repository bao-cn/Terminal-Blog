import { describe, expect, it } from "vitest";
import { defaultSiteConfig, mergeSiteConfig } from "../lib/site-config";

describe("site configuration", () => {
  it("normalizes the cookie notice object", () => {
    const config = mergeSiteConfig({ cookieNotice: { enable: false, message: "No storage." } });
    expect(config.cookieNotice).toEqual({ enable: false, message: "No storage." });
  });

  it("keeps legacy cookie notice strings enabled", () => {
    const config = mergeSiteConfig({ cookieNotice: "Legacy notice" });
    expect(config.cookieNotice).toEqual({ enable: true, message: "Legacy notice" });
  });

  it("fills missing cookie notice fields from defaults", () => {
    const config = mergeSiteConfig({ cookieNotice: { enable: false } });
    expect(config.cookieNotice).toEqual({
      enable: false,
      message: defaultSiteConfig.cookieNotice.message,
    });
  });
});
