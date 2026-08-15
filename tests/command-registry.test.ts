import { describe, expect, it } from "vitest";
import {
  commandReference,
  commandRegistry,
  findCommand,
  getCommandSyntax,
  validateCommandArguments,
} from "../lib/command-registry";
import { splitCommand, splitPipeline } from "../lib/terminal-command-parser";

describe("command registry", () => {
  it("generates help entries for every visible registered command", () => {
    const visibleCommands = commandRegistry
      .filter((definition) => !definition.hidden)
      .map((definition) => definition.command);
    expect(commandReference.map((definition) => definition.command)).toEqual(visibleCommands);
  });

  it("derives syntax and validates required arguments", () => {
    const upload = findCommand("upload");
    expect(upload).toBeDefined();
    expect(getCommandSyntax(upload!)).toBe("upload <file> <target_path>");
    expect(validateCommandArguments(upload!, ["remote:///image.png"])).toBe("usage: upload <file> <target_path>");
    expect(validateCommandArguments(upload!, ["remote:///image.png", "access/image.png"])).toBeNull();
  });

  it("parses quoted arguments and pipelines consistently", () => {
    expect(splitCommand('grep "hello world" article.md')).toEqual(["grep", "hello world", "article.md"]);
    expect(splitPipeline('cat "pipe|inside.md" | grep signal')).toEqual(['cat "pipe|inside.md"', "grep signal"]);
  });
});
