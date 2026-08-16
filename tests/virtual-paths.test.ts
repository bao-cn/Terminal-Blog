import { describe, expect, it } from "vitest";
import { isSiteConfigVirtualPath, SITE_CONFIG_VIRTUAL_PATH } from "../lib/virtual-paths";

describe("virtual paths", () => {
  it("recognizes the short site configuration path", () => {
    expect(SITE_CONFIG_VIRTUAL_PATH).toBe("config");
    expect(isSiteConfigVirtualPath("config")).toBe(true);
    expect(isSiteConfigVirtualPath("./config")).toBe(true);
    expect(isSiteConfigVirtualPath("/config/")).toBe(true);
  });

  it("does not recognize the retired system configuration path", () => {
    expect(isSiteConfigVirtualPath("system/config")).toBe(false);
    expect(isSiteConfigVirtualPath("./system/config")).toBe(false);
  });
});
