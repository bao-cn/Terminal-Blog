export type FrontmatterValue = string | string[];

export function parseFrontmatter(source: string) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { metadata: {} as Record<string, FrontmatterValue>, content: source.trim() };
  const metadata: Record<string, FrontmatterValue> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^"|"$/g, "");
    metadata[key] =
      value.startsWith("[") && value.endsWith("]")
        ? value
            .slice(1, -1)
            .split(",")
            .map((item) => item.trim().replace(/^"|"$/g, ""))
            .filter(Boolean)
        : value;
  }
  return { metadata, content: match[2].trim() };
}

export function serializeArticleDocument(article: {
  id: string;
  title: string;
  category?: string;
  date: string;
  readTime: string;
  tags: string[];
  pinyin?: string;
  excerpt: string;
  content: string;
}) {
  const tags = article.tags.map((tag) => tag.replace(/[，,\]]/g, "")).join(", ");
  const category = article.category ? "\ncategory: " + article.category : "";
  return (
    "---\n" +
    'title: "' +
    article.title.replace(/"/g, '\\"') +
    '"\nslug: ' +
    article.id +
    category +
    "\ndate: " +
    article.date +
    "\nreadTime: " +
    article.readTime +
    "\ntags: [" +
    tags +
    "]\npinyin: " +
    (article.pinyin || "") +
    '\nexcerpt: "' +
    article.excerpt.replace(/"/g, '\\"') +
    '"\n---\n\n' +
    article.content.trim() +
    "\n"
  );
}
