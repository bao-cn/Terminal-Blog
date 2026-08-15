import { describe, expect, it } from "vitest";
import { parseFrontmatter, serializeArticleDocument } from "../lib/article-codec";

describe("article codec", () => {
  it("serializes and parses article metadata without indexing content", () => {
    const source = serializeArticleDocument({
      id: "typed-shell",
      title: "Typed shell",
      category: "systems",
      date: "2026-08-15",
      readTime: "4 min",
      tags: ["typescript", "terminal"],
      pinyin: "typed shell",
      excerpt: "A strict terminal.",
      content: "# Body\n\nPrivate article body.",
    });
    const parsed = parseFrontmatter(source);
    expect(parsed.metadata).toMatchObject({
      slug: "typed-shell",
      category: "systems",
      tags: ["typescript", "terminal"],
    });
    expect(parsed.content).toBe("# Body\n\nPrivate article body.");
  });

  it("treats a document without frontmatter as content", () => {
    expect(parseFrontmatter("  plain text  ")).toEqual({ metadata: {}, content: "plain text" });
  });
});
