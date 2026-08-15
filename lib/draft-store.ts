import fs from "node:fs";
import path from "node:path";
import { writeFileAtomically } from "./atomic-file";
import { parseFrontmatter, serializeArticleDocument } from "./article-codec";
import { loadArticles, writeArticleFile, type Article } from "./article-store";

const draftsDirectory = path.join(process.cwd(), "draft");

function safeSegment(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function resolveDraftSource(sourcePath: string) {
  const resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), sourcePath);
  const root = `${draftsDirectory}${path.sep}`;
  return resolved.startsWith(root) ? resolved : null;
}

export function loadDrafts(): Article[] {
  if (!fs.existsSync(draftsDirectory)) return [];
  const drafts: Article[] = [];
  for (const file of fs.readdirSync(draftsDirectory, { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith(".md")) continue;
    const absolutePath = path.join(draftsDirectory, file.name);
    const parsed = parseFrontmatter(fs.readFileSync(absolutePath, "utf8"));
    const metadata = parsed.metadata;
    drafts.push({
      id: String(metadata.slug || file.name.replace(/\.md$/i, "")),
      title: String(metadata.title || file.name),
      category: String(metadata.category || "systems"),
      date: String(metadata.date || "1970-01-01"),
      readTime: String(metadata.readTime || "3 min"),
      excerpt: String(metadata.excerpt || ""),
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      pinyin: String(metadata.pinyin || ""),
      content: parsed.content,
      sourcePath: path.relative(process.cwd(), absolutePath),
    });
  }
  return drafts.sort((left, right) => right.date.localeCompare(left.date));
}

export function findDraft(id: string) {
  const normalized = id.replace(/\.md$/i, "").toLowerCase();
  if (!normalized) return null;
  return loadDrafts().find((draft) => draft.id.toLowerCase() === normalized) || null;
}

export function writeDraftFile(draft: Article, previousSourcePath?: string) {
  const normalizedDraft = { ...draft, id: safeSegment(draft.id, `draft-${Date.now().toString(36)}`) };
  const destination = path.join(draftsDirectory, `${normalizedDraft.id}.md`);
  const previous = previousSourcePath ? resolveDraftSource(previousSourcePath) : null;
  if (fs.existsSync(destination) && destination !== previous) {
    const error = new Error("draft already exists");
    (error as Error & { code?: string }).code = "EEXIST";
    throw error;
  }
  writeFileAtomically(destination, serializeArticleDocument(normalizedDraft));
  if (previous && previous !== destination && fs.existsSync(previous)) fs.rmSync(previous);
  return { ...normalizedDraft, sourcePath: path.relative(process.cwd(), destination) };
}

export function removeDraftFile(draft: Article) {
  const source = draft.sourcePath
    ? resolveDraftSource(draft.sourcePath)
    : resolveDraftSource(path.join("draft", `${safeSegment(draft.id, "missing")}.md`));
  if (source && fs.existsSync(source)) fs.rmSync(source);
}

export function publishDraftFile(draft: Article) {
  const article = { ...draft, sourcePath: undefined };
  const sourcePath = writeArticleFile(article);
  removeDraftFile(draft);
  loadArticles();
  return { ...article, sourcePath };
}
