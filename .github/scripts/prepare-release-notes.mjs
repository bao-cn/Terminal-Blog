import fs from "node:fs";
import { pathToFileURL } from "node:url";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractChangelogSection(changelog, version) {
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\](?: \\- .*)?$`, "m");
  const match = heading.exec(changelog);

  if (!match) {
    throw new Error(`CHANGELOG.md does not contain a section for ${version}.`);
  }

  const sectionStart = match.index + match[0].length;
  const remaining = changelog.slice(sectionStart);
  const nextVersion = remaining.search(/^## \[/m);
  const section = (nextVersion === -1 ? remaining : remaining.slice(0, nextVersion)).trim();

  if (!section) {
    throw new Error(`The CHANGELOG.md section for ${version} is empty.`);
  }

  return section;
}

export function normalizeIssueReferences(value) {
  const references = [];
  const seen = new Set();

  for (const match of value.matchAll(/#?(\d+)/g)) {
    const reference = `#${match[1]}`;
    if (!seen.has(reference)) {
      seen.add(reference);
      references.push(reference);
    }
  }

  return references;
}

export function buildReleaseNotes({ changelog, generatedBody, relatedIssues, version }) {
  const parts = [`## Changelog\n\n${extractChangelogSection(changelog, version)}`];
  const issues = normalizeIssueReferences(relatedIssues);

  if (issues.length > 0) {
    parts.push(`## Related Issues\n\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }

  if (generatedBody.trim()) {
    parts.push(generatedBody.trim());
  }

  return `${parts.join("\n\n")}\n`;
}

function parseArguments(argv) {
  const values = new Map();

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? "the end of the command"}.`);
    }

    values.set(key.slice(2), value);
  }

  return values;
}

function run() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const version = argumentsMap.get("version");
  const changelogPath = argumentsMap.get("changelog");
  const generatedPath = argumentsMap.get("generated");
  const outputPath = argumentsMap.get("output");

  if (!version || !changelogPath || !generatedPath || !outputPath) {
    throw new Error("Required arguments: --version, --changelog, --generated, and --output.");
  }

  const generated = JSON.parse(fs.readFileSync(generatedPath, "utf8"));
  const notes = buildReleaseNotes({
    changelog: fs.readFileSync(changelogPath, "utf8"),
    generatedBody: typeof generated.body === "string" ? generated.body : "",
    relatedIssues: argumentsMap.get("issues") ?? "",
    version,
  });

  fs.writeFileSync(outputPath, notes, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
