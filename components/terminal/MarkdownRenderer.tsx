"use client";

import { Children, isValidElement, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Article } from "@/lib/article-store";

type CodeElementProps = {
  className?: string;
  children?: ReactNode;
};

function ShikiCodeBlock({ code, language }: { code: string; language: string }) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setHighlightedHtml(null);
    void import("shiki/bundle/web")
      .then(({ codeToHtml }) =>
        codeToHtml(code, {
          lang: language,
          themes: { light: "github-light", dark: "github-dark" },
          defaultColor: false,
        }),
      )
      .then((html) => {
        if (active) setHighlightedHtml(html);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [code, language]);

  if (!highlightedHtml) {
    return (
      <pre className="article-code-block article-code-fallback">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    );
  }

  return <div className="article-code-block" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />;
}

function MarkdownPre({ children }: ComponentProps<"pre">) {
  const codeElement = Children.toArray(children)[0];
  if (isValidElement<CodeElementProps>(codeElement)) {
    const language = /language-([^\s]+)/.exec(codeElement.props.className || "")?.[1];
    if (language) {
      return <ShikiCodeBlock code={String(codeElement.props.children || "").replace(/\n$/, "")} language={language} />;
    }
  }
  return <pre className="article-code-block article-code-fallback">{children}</pre>;
}

const markdownComponents: Components = {
  pre: MarkdownPre,
  img({ node, alt, ...props }) {
    void node;
    return <img {...props} alt={alt || ""} loading="lazy" decoding="async" />;
  },
  a({ node, href, ...props }) {
    void node;
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a {...props} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} />
    );
  },
};

function resolveRelativePath(sourcePath: string, requestedPath: string) {
  const segments = sourcePath.replaceAll("\\", "/").split("/").slice(0, -1);
  for (const segment of requestedPath.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

function resolveArticleUrl(article: Article, value: string) {
  const safeValue = defaultUrlTransform(value);
  if (!safeValue || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(safeValue)) return safeValue;
  const suffixIndex = safeValue.search(/[?#]/);
  const requestedPath = suffixIndex < 0 ? safeValue : safeValue.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : safeValue.slice(suffixIndex);
  const sourcePath = article.sourcePath || `articles/${article.category}/${article.id}.md`;
  const resolvedPath = resolveRelativePath(sourcePath, requestedPath);
  const resolvedUrl = resolvedPath.startsWith("access/") ? `/${resolvedPath}` : safeValue;
  return defaultUrlTransform(`${resolvedUrl}${resolvedUrl === safeValue ? "" : suffix}`);
}

export default function MarkdownRenderer({ article }: { article: Article }) {
  const transformUrl = useMemo(() => (value: string) => resolveArticleUrl(article, value), [article]);
  return (
    <div className="article-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} urlTransform={transformUrl} skipHtml>
        {article.content}
      </ReactMarkdown>
    </div>
  );
}
