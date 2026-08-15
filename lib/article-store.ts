import fs from "node:fs";
import path from "node:path";
import { writeFileAtomically } from "./atomic-file";
import { parseFrontmatter, serializeArticleDocument } from "./article-codec";
import { removeArticleIndex, syncArticleIndex } from "./article-index-store";

export { parseFrontmatter } from "./article-codec";

export type Article = {
  id: string;
  title: string;
  category: string;
  date: string;
  readTime: string;
  excerpt: string;
  tags: string[];
  content: string;
  pinyin?: string;
  sourcePath?: string;
};

const articlesDirectory = path.join(process.cwd(), "articles");

function safeSegment(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function normalizeCategoryName(value: string) {
  return safeSegment(value, "");
}

export function loadArticleCategories() {
  if (!fs.existsSync(articlesDirectory)) return [];
  return fs
    .readdirSync(articlesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function createArticleCategory(value: string) {
  const category = normalizeCategoryName(value);
  if (!category) return null;
  fs.mkdirSync(path.join(articlesDirectory, category), { recursive: true });
  return category;
}

export function removeEmptyArticleCategory(value: string) {
  const category = normalizeCategoryName(value);
  if (!category) return false;
  const directory = path.join(articlesDirectory, category);
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return false;
  if (fs.readdirSync(directory).length > 0) return false;
  fs.rmdirSync(directory);
  return true;
}

function articlePath(id: string, category: string) {
  const safeCategory = safeSegment(category, "systems");
  const safeId = safeSegment(id, `signal-${Date.now()}`);
  return path.join(articlesDirectory, safeCategory, `${safeId}.md`);
}

function resolveArticleSource(sourcePath: string) {
  const resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), sourcePath);
  const root = `${articlesDirectory}${path.sep}`;
  return resolved.startsWith(root) ? resolved : null;
}

export function writeArticleFile(article: Article, previousSourcePath?: string) {
  const destination = articlePath(article.id, article.category);
  const previous = previousSourcePath ? resolveArticleSource(previousSourcePath) : null;
  if (fs.existsSync(destination) && destination !== previous) {
    const error = new Error("article already exists");
    (error as Error & { code?: string }).code = "EEXIST";
    throw error;
  }
  writeFileAtomically(destination, serializeArticleDocument(article));
  if (previous && previous !== destination && fs.existsSync(previous)) fs.rmSync(previous);
  return path.relative(process.cwd(), destination);
}

export function removeArticleFile(article: Article) {
  const source = article.sourcePath
    ? resolveArticleSource(article.sourcePath)
    : articlePath(article.id, article.category);
  if (!source || !fs.existsSync(source)) return;
  fs.rmSync(source);
  removeArticleIndex(article.id);
}

export function moveArticleFile(article: Article, targetCategory: string) {
  const category = normalizeCategoryName(targetCategory);
  if (!category) throw new Error("invalid category");
  const moved = { ...article, category };
  const sourcePath = writeArticleFile(moved, article.sourcePath);
  return { ...moved, sourcePath };
}

export function loadArticles(): Article[] {
  if (!fs.existsSync(articlesDirectory)) {
    syncArticleIndex([]);
    return [];
  }
  const articles: Article[] = [];
  for (const category of fs.readdirSync(articlesDirectory, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryPath = path.join(articlesDirectory, category.name);
    for (const file of fs.readdirSync(categoryPath, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const sourcePath = path.join(categoryPath, file.name);
      const parsed = parseFrontmatter(fs.readFileSync(sourcePath, "utf8"));
      const metadata = parsed.metadata;
      articles.push({
        id: String(metadata.slug || file.name.replace(/\.md$/i, "")),
        title: String(metadata.title || file.name),
        category: category.name,
        date: String(metadata.date || "1970-01-01"),
        readTime: String(metadata.readTime || "3 min"),
        excerpt: String(metadata.excerpt || ""),
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        pinyin: String(metadata.pinyin || ""),
        content: parsed.content,
        sourcePath: path.relative(process.cwd(), sourcePath),
      });
    }
  }
  const sorted = articles.sort((left, right) => right.date.localeCompare(left.date));
  syncArticleIndex(sorted);
  return sorted;
}
