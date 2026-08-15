import { describe, expect, it } from "vitest";
import { defaultRootPassword, resolveBootstrapRootPassword } from "../lib/auth-config";

describe("root bootstrap configuration", () => {
  it("uses root when no password is configured", () => {
    expect(defaultRootPassword).toBe("root");
    expect(resolveBootstrapRootPassword(undefined)).toBe("root");
    expect(resolveBootstrapRootPassword("   ")).toBe("root");
  });

  it("allows deployments to override the first-start password", () => {
    expect(resolveBootstrapRootPassword("deployment-secret")).toBe("deployment-secret");
  });
});
