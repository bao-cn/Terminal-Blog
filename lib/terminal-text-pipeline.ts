import type { Article } from "./article-store";
import { serializeArticleDocument } from "./article-codec";
import { splitCommand } from "./terminal-command-parser";

export type TextPipelineResult = { value?: string; error?: string };
export type ArticleResolver = (query: string) => Article | null;

export function runTextStage(
  command: string,
  args: string[],
  resolveArticle: ArticleResolver,
  pipedInput?: string,
): TextPipelineResult {
  if (command === "cat") {
    const finalArgument = args.at(-1)?.toLowerCase();
    const articleArgs = finalArgument && ["source", "render"].includes(finalArgument) ? args.slice(0, -1) : args;
    if (!articleArgs.length && pipedInput !== undefined) return { value: pipedInput };
    const article = resolveArticle(articleArgs.join(" "));
    return article
      ? { value: serializeArticleDocument(article) }
      : { error: `cat: ${articleArgs.join(" ") || "missing article"}: file not found` };
  }

  if (command === "head" || command === "tail") {
    let mode: "lines" | "bytes" = "lines";
    let amount = 10;
    const articleParts: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      const token = args[index];
      const compactOption = token.match(/^-(n|c)(\d+)$/);
      const longOption = token.match(/^--(lines|bytes)=(\d+)$/);
      if (compactOption) {
        mode = compactOption[1] === "n" ? "lines" : "bytes";
        amount = Number.parseInt(compactOption[2], 10);
      } else if (longOption) {
        mode = longOption[1] === "lines" ? "lines" : "bytes";
        amount = Number.parseInt(longOption[2], 10);
      } else if (["-n", "--lines", "-c", "--bytes"].includes(token)) {
        const value = Number.parseInt(args[index + 1], 10);
        if (!Number.isFinite(value) || value < 0) return { error: `${command}: invalid count` };
        mode = token === "-n" || token === "--lines" ? "lines" : "bytes";
        amount = value;
        index += 1;
      } else {
        articleParts.push(token);
      }
    }
    if (!Number.isFinite(amount) || amount < 0) return { error: `${command}: invalid count` };
    const article = articleParts.length ? resolveArticle(articleParts.join(" ")) : null;
    if (articleParts.length && !article) return { error: `${command}: ${articleParts.join(" ")}: file not found` };
    const source = article ? serializeArticleDocument(article) : pipedInput;
    if (source === undefined) return { error: `${command}: missing article or pipe input` };
    if (mode === "bytes") {
      const encoded = new TextEncoder().encode(source);
      const bytes = command === "head" ? encoded.slice(0, amount) : encoded.slice(Math.max(0, encoded.length - amount));
      return { value: new TextDecoder().decode(bytes) };
    }
    if (amount === 0) return { value: "" };
    const lines = source.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    return { value: (command === "head" ? lines.slice(0, amount) : lines.slice(-amount)).join("\n") };
  }

  if (command === "grep") {
    const query = args[0];
    if (!query) return { error: "grep: missing search text" };
    const articleParts = args.slice(1);
    const article = articleParts.length ? resolveArticle(articleParts.join(" ")) : null;
    if (articleParts.length && !article) return { error: `grep: ${articleParts.join(" ")}: file not found` };
    const source = article ? article.content : pipedInput;
    if (source === undefined) return { error: "grep: missing article or pipe input" };
    return {
      value: source
        .split(/\r?\n/)
        .filter((line) => line.includes(query))
        .join("\n"),
    };
  }

  return { error: `pipeline: ${command}: unsupported command` };
}

export function runTextPipeline(stages: string[], resolveArticle: ArticleResolver): TextPipelineResult {
  let stream: string | undefined;
  for (const stage of stages) {
    const tokens = splitCommand(stage);
    const command = (tokens.shift() || "").toLowerCase();
    const result = runTextStage(command, tokens, resolveArticle, stream);
    if (result.error) return result;
    stream = result.value || "";
  }
  return { value: stream || "" };
}
