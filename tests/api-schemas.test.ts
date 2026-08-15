import { describe, expect, it } from "vitest";
import { articleWriteSchema, categorySchema } from "../lib/api-schemas";

describe("API schemas", () => {
  it("accepts a bounded article payload", () => {
    expect(
      articleWriteSchema.parse({ id: "entry", title: "Entry", category: "systems", tags: ["security"] }),
    ).toMatchObject({ id: "entry", category: "systems" });
  });

  it("rejects unknown fields and oversized tag collections", () => {
    expect(() =>
      articleWriteSchema.parse({
        id: "entry",
        title: "Entry",
        category: "systems",
        tags: Array.from({ length: 33 }, (_, index) => `tag-${index}`),
        privileged: true,
      }),
    ).toThrow();
  });

  it("rejects empty categories", () => {
    expect(() => categorySchema.parse({ category: "   " })).toThrow();
  });
});
