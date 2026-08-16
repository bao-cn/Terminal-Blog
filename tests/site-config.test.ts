import { describe, expect, it } from "vitest";
import { defaultSiteConfig, formatSiteTitle, mergeSiteConfig } from "../lib/site-config";

describe("site configuration", () => {
  it("normalizes the GitHub button configuration", () => {
    expect(mergeSiteConfig({ github: { enable: false } }).github).toEqual({
      enable: false,
      href: defaultSiteConfig.github.href,
    });
    expect(mergeSiteConfig({ github: { href: "javascript:alert(1)" } }).github.href).toBe(
      defaultSiteConfig.github.href,
    );
  });

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

  it("formats configured site and article titles", () => {
    const config = mergeSiteConfig({
      blogName: "Example Blog",
      description: "Example description",
      titleTemplate: "{ArticleName} :: {BlogName}",
    });
    expect(formatSiteTitle(config)).toBe("Example description :: Example Blog");
    expect(formatSiteTitle(config, "Article title")).toBe("Article title :: Example Blog");
  });
});
