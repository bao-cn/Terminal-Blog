import { describe, expect, it } from "vitest";
import type { Article } from "../lib/article-store";
import { runTextPipeline, runTextStage } from "../lib/terminal-text-pipeline";

const article: Article = {
  id: "signal",
  title: "Signal",
  category: "systems",
  date: "2026-08-15",
  readTime: "1 min",
  excerpt: "",
  tags: [],
  content: "alpha\nsignal one\nbeta\nsignal two",
};
const resolveArticle = (query: string) => (query === "signal" ? article : null);

describe("terminal text pipeline", () => {
  it("combines cat and grep without React state", () => {
    expect(runTextPipeline(["cat signal", "grep signal"], resolveArticle).value).toContain("signal one");
  });

  it("supports line and byte options", () => {
    expect(runTextStage("head", ["-n", "2"], resolveArticle, "one\ntwo\nthree")).toEqual({ value: "one\ntwo" });
    expect(runTextStage("tail", ["-c", "3"], resolveArticle, "abcdef")).toEqual({ value: "def" });
  });

  it("returns terminal-style errors for missing inputs", () => {
    expect(runTextStage("grep", ["signal"], resolveArticle)).toEqual({ error: "grep: missing article or pipe input" });
  });
});
