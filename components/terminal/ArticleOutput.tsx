import type { Article } from "@/lib/article-store";
import MarkdownRenderer from "./MarkdownRenderer";

export function ArticleOutput({ article }: { article: Article }) {
  return (
    <article className="article-output">
      <div className="article-meta">
        <span>{article.category}</span>
        <span>{article.date}</span>
        <span>{article.readTime}</span>
      </div>
      <h2 className="article-title">{article.title}</h2>
      <p className="article-deck">{article.excerpt}</p>
      <div className="article-rule" />
      <MarkdownRenderer article={article} />
      <div className="tag-row">
        {article.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
      <div className="article-eof">-- EOF --</div>
    </article>
  );
}

export function MarkdownSource({ article }: { article: Article }) {
  const source = [
    "---",
    `title: \"${article.title}\"`,
    `slug: ${article.id}`,
    `category: ${article.category}`,
    `date: ${article.date}`,
    `readTime: ${article.readTime}`,
    `tags: [${article.tags.join(", ")}]`,
    "---",
    "",
    `# ${article.title}`,
    "",
    `> ${article.excerpt}`,
    "",
    article.content,
  ].join("\n");
  return (
    <pre className="terminal-plain-output">
      <code>{source}</code>
    </pre>
  );
}
