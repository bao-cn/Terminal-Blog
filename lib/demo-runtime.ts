import { parseFrontmatter } from "./article-codec";
import { mergeSiteConfig, type SiteConfig } from "./site-config";
import type { Article } from "./article-store";
import type { AccessFileInfo } from "./upload-store";

export type DemoBootstrap = {
  accessFiles: AccessFileInfo[];
  articles: Article[];
  categories: string[];
  config: SiteConfig;
};

export type TerminalApi = {
  fetch: typeof fetch;
  reset: () => void;
};

export const demoInfo = {
  enabled: process.env.NEXT_PUBLIC_TERMINAL_DEMO === "true",
  baseVersion: process.env.NEXT_PUBLIC_TERMINAL_DEMO_BASE_VERSION || "development",
  baseRef: process.env.NEXT_PUBLIC_TERMINAL_DEMO_BASE_REF || "main",
};

const demoToken = "demo-root-session";

function cloneArticle(article: Article): Article {
  return { ...article, tags: [...article.tags] };
}

function cloneBootstrap(bootstrap: DemoBootstrap) {
  return {
    accessFiles: bootstrap.accessFiles.map((file) => ({ ...file })),
    articles: bootstrap.articles.map(cloneArticle),
    categories: [...bootstrap.categories],
    config: mergeSiteConfig(bootstrap.config),
  };
}

function normalizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

function articleSourcePath(article: Article) {
  return `articles/${article.category}/${article.id}.md`;
}

function draftSourcePath(article: Article) {
  return `draft/${article.id}.md`;
}

function headerValue(init: RequestInit | undefined, name: string) {
  return new Headers(init?.headers).get(name);
}

function bodyJson(init: RequestInit | undefined) {
  if (typeof init?.body !== "string") return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function articleFromBody(body: Record<string, unknown>): Article | null {
  const id = normalizeSegment(String(body.id || ""));
  const category = normalizeSegment(String(body.category || ""));
  const title = String(body.title || "").trim();
  if (!id || !category || !title) return null;
  return {
    id,
    title,
    category,
    date: String(body.date || new Date().toISOString().slice(0, 10)),
    readTime: String(body.readTime || "3 min"),
    excerpt: String(body.excerpt || ""),
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    pinyin: String(body.pinyin || ""),
    content: String(body.content || ""),
  };
}

function uploadedArticle(file: File, category: string, destinationName: string): Promise<Article> {
  return file.text().then((source) => {
    const parsed = parseFrontmatter(source);
    const metadata = parsed.metadata;
    const id = normalizeSegment(String(metadata.slug || destinationName.replace(/\.md$/i, "")));
    return {
      id,
      title: String(metadata.title || destinationName),
      category,
      date: String(metadata.date || new Date().toISOString().slice(0, 10)),
      readTime: String(metadata.readTime || "3 min"),
      excerpt: String(metadata.excerpt || ""),
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      pinyin: String(metadata.pinyin || ""),
      content: parsed.content,
      sourcePath: `articles/${category}/${destinationName}`,
    };
  });
}

export function createTerminalApi(bootstrap: DemoBootstrap, options: { demo?: boolean } = {}): TerminalApi {
  if (!(options.demo ?? demoInfo.enabled)) {
    return {
      fetch: (input, init) => globalThis.fetch(input, init),
      reset: () => undefined,
    };
  }

  const initial = cloneBootstrap(bootstrap);
  let state = cloneBootstrap(initial);
  let drafts: Article[] = [];
  let password = "root";
  let rootSession = false;
  let configRevision = 1;
  const objectUrls = new Set<string>();

  const hasRootAccess = (init?: RequestInit) =>
    rootSession || headerValue(init, "authorization") === `Bearer ${demoToken}`;
  const forbidden = () => json({ ok: false, error: "root session required" }, 403);

  const reset = () => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
    state = cloneBootstrap(initial);
    drafts = [];
    password = "root";
    rootSession = false;
    configRevision += 1;
  };

  const demoFetch: typeof fetch = async (input, init) => {
    const requestUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const url = new URL(requestUrl, "https://terminal.demo");
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (path === "/api/auth") {
      if (method === "POST") {
        const body = bodyJson(init);
        if (String(body.password || "") !== password) return json({ ok: false }, 401);
        if (body.session === false) return json({ ok: true, token: demoToken });
        rootSession = true;
        return json({ ok: true });
      }
      if (method === "DELETE") {
        rootSession = false;
        return json({ ok: true });
      }
      if (method === "PUT") {
        if (!hasRootAccess(init)) return forbidden();
        const nextPassword = String(bodyJson(init).password || "");
        if (nextPassword.length < 16 || nextPassword.length > 256) {
          return json({ ok: false, error: "password must contain 16 to 256 characters" }, 422);
        }
        password = nextPassword;
        rootSession = false;
        return json({ ok: true });
      }
    }

    if (path === "/api/site-config") {
      const responseHeaders = { "X-Site-Config-MD5": `demo-${configRevision}` };
      if (method === "GET") return json(state.config, 200, responseHeaders);
      if (!hasRootAccess(init)) return forbidden();
      state.config = mergeSiteConfig(bodyJson(init));
      configRevision += 1;
      return json({ ok: true, config: state.config }, 200, {
        "X-Site-Config-MD5": `demo-${configRevision}`,
      });
    }

    if (path === "/api/articles") {
      if (method === "GET") {
        const query = (url.searchParams.get("q") || "").toLowerCase();
        const category = url.searchParams.get("category");
        const tag = url.searchParams.get("tag");
        const rows = state.articles.filter(
          (article) =>
            (!query || `${article.title} ${article.excerpt} ${article.content}`.toLowerCase().includes(query)) &&
            (!category || article.category === category) &&
            (!tag || article.tags.includes(tag)),
        );
        return json({ ok: true, rows });
      }
      if (!hasRootAccess(init)) return forbidden();
      if (method === "POST") {
        const body = bodyJson(init);
        const article = articleFromBody(body);
        if (!article) return json({ ok: false, error: "invalid article fields" }, 422);
        const previousSourcePath = String(body.previousSourcePath || "");
        const conflict = state.articles.some(
          (item) => item.id === article.id && (!previousSourcePath || item.sourcePath !== previousSourcePath),
        );
        if (conflict) return json({ ok: false, error: "article already exists" }, 409);
        const stored = { ...article, sourcePath: articleSourcePath(article) };
        state.articles = [
          stored,
          ...state.articles.filter(
            (item) => item.id !== article.id && (!previousSourcePath || item.sourcePath !== previousSourcePath),
          ),
        ];
        if (!state.categories.includes(article.category)) state.categories.push(article.category);
        state.categories.sort();
        return json({ ok: true, article: stored });
      }
      if (method === "PATCH") {
        const body = bodyJson(init);
        const id = String(body.id || "");
        const category = normalizeSegment(String(body.category || ""));
        const current = state.articles.find((article) => article.id === id);
        if (!current) return json({ ok: false, error: "article not found" }, 404);
        if (!category) return json({ ok: false, error: "invalid category" }, 422);
        const moved = { ...current, category, sourcePath: `articles/${category}/${current.id}.md` };
        state.articles = state.articles.map((article) => (article.id === id ? moved : article));
        if (!state.categories.includes(category)) state.categories.push(category);
        state.categories.sort();
        return json({ ok: true, article: moved });
      }
      if (method === "DELETE") {
        const id = url.searchParams.get("id") || "";
        if (!state.articles.some((article) => article.id === id)) {
          return json({ ok: false, error: "article not found" }, 404);
        }
        state.articles = state.articles.filter((article) => article.id !== id);
        return json({ ok: true, id });
      }
    }

    if (path === "/api/drafts") {
      if (!hasRootAccess(init)) return forbidden();
      if (method === "GET") {
        const id = url.searchParams.get("id");
        if (!id) return json({ ok: true, drafts: drafts.map(cloneArticle) });
        const draft = drafts.find((item) => item.id === id);
        return draft
          ? json({ ok: true, draft: cloneArticle(draft) })
          : json({ ok: false, error: "draft not found" }, 404);
      }
      if (method === "POST") {
        const body = bodyJson(init);
        const draft = articleFromBody(body);
        if (!draft) return json({ ok: false, error: "invalid draft fields" }, 422);
        const previousSourcePath = String(body.previousSourcePath || "");
        const conflict = drafts.some(
          (item) => item.id === draft.id && (!previousSourcePath || item.sourcePath !== previousSourcePath),
        );
        if (conflict) return json({ ok: false, error: "draft already exists" }, 409);
        const stored = { ...draft, sourcePath: draftSourcePath(draft) };
        drafts = [
          stored,
          ...drafts.filter(
            (item) => item.id !== draft.id && (!previousSourcePath || item.sourcePath !== previousSourcePath),
          ),
        ];
        return json({ ok: true, draft: stored });
      }
      if (method === "PATCH") {
        const id = String(bodyJson(init).id || "");
        const draft = drafts.find((item) => item.id === id);
        if (!draft) return json({ ok: false, error: "draft not found" }, 404);
        if (state.articles.some((article) => article.id === id)) {
          return json({ ok: false, error: "article already exists" }, 409);
        }
        const article = { ...draft, sourcePath: articleSourcePath(draft) };
        state.articles = [article, ...state.articles];
        drafts = drafts.filter((item) => item.id !== id);
        if (!state.categories.includes(article.category)) state.categories.push(article.category);
        state.categories.sort();
        return json({ ok: true, article });
      }
      if (method === "DELETE") {
        const id = url.searchParams.get("id") || "";
        if (!drafts.some((draft) => draft.id === id)) return json({ ok: false, error: "draft not found" }, 404);
        drafts = drafts.filter((draft) => draft.id !== id);
        return json({ ok: true, id });
      }
    }

    if (path === "/api/categories") {
      if (method === "GET") return json({ ok: true, categories: [...state.categories] });
      if (!hasRootAccess(init)) return forbidden();
      if (method === "POST") {
        const category = normalizeSegment(String(bodyJson(init).category || ""));
        if (!category) return json({ ok: false, error: "invalid category" }, 422);
        if (!state.categories.includes(category)) state.categories.push(category);
        state.categories.sort();
        return json({ ok: true, category });
      }
      if (method === "DELETE") {
        const category = normalizeSegment(url.searchParams.get("category") || "");
        if (!state.categories.includes(category) || state.articles.some((article) => article.category === category)) {
          return json({ ok: false, error: "category not found or not empty" }, 409);
        }
        state.categories = state.categories.filter((item) => item !== category);
        return json({ ok: true, category });
      }
    }

    if (path === "/api/upload") {
      if (method === "GET") return json({ ok: true, accessFiles: state.accessFiles.map((file) => ({ ...file })) });
      if (!hasRootAccess(init)) return forbidden();
      if (method === "POST" && init?.body instanceof FormData) {
        const file = init.body.get("file");
        const requestedTarget = String(init.body.get("targetPath") || "")
          .replaceAll("\\", "/")
          .replace(/^\/+/, "");
        if (!(file instanceof File) || !requestedTarget)
          return json({ ok: false, error: "file and targetPath are required" }, 422);
        const segments = requestedTarget.split("/").filter(Boolean);
        if (segments[0]?.toLowerCase() === "articles") {
          const category = normalizeSegment(segments[1] || "");
          const destinationName = segments[2] || file.name;
          if (!category || !destinationName.toLowerCase().endsWith(".md")) {
            return json({ ok: false, error: "articles target must be articles/<category>[/<file>.md]" }, 422);
          }
          const article = await uploadedArticle(file, category, destinationName);
          if (state.articles.some((item) => item.id === article.id)) {
            return json({ ok: false, error: "article destination already exists" }, 409);
          }
          state.articles = [article, ...state.articles];
          if (!state.categories.includes(category)) state.categories.push(category);
          state.categories.sort();
          return json({
            ok: true,
            kind: "article",
            sourcePath: article.sourcePath,
            articles: state.articles.map(cloneArticle),
            categories: [...state.categories],
            accessFiles: state.accessFiles.map((item) => ({ ...item })),
          });
        }
        if (segments[0]?.toLowerCase() !== "access") {
          return json({ ok: false, error: "upload target must start with articles/ or access/" }, 422);
        }
        const accessSegments = segments.slice(1);
        const requestedName = accessSegments.at(-1) || "";
        const relativePath = /\.[a-z0-9]+$/i.test(requestedName)
          ? accessSegments.join("/")
          : [...accessSegments, file.name].filter(Boolean).join("/");
        if (!relativePath || state.accessFiles.some((item) => item.path === relativePath)) {
          return json({ ok: false, error: "access destination already exists" }, 409);
        }
        const objectUrl = URL.createObjectURL(file);
        objectUrls.add(objectUrl);
        const accessFile = { path: relativePath, size: file.size, url: objectUrl };
        state.accessFiles = [...state.accessFiles, accessFile].sort((left, right) =>
          left.path.localeCompare(right.path),
        );
        return json({
          ok: true,
          kind: "access",
          sourcePath: `access/${relativePath}`,
          url: objectUrl,
          articles: state.articles.map(cloneArticle),
          categories: [...state.categories],
          accessFiles: state.accessFiles.map((item) => ({ ...item })),
        });
      }
      if (method === "DELETE") {
        const target = (url.searchParams.get("path") || "").replace(/^access\//, "");
        const existing = state.accessFiles.find((file) => file.path === target);
        if (!existing) return json({ ok: false, error: "access file not found" }, 404);
        if (objectUrls.has(existing.url)) {
          URL.revokeObjectURL(existing.url);
          objectUrls.delete(existing.url);
        }
        state.accessFiles = state.accessFiles.filter((file) => file.path !== target);
        return json({ ok: true, accessFiles: state.accessFiles.map((file) => ({ ...file })) });
      }
    }

    return json({ ok: false, error: `unsupported demo endpoint: ${method} ${path}` }, 404);
  };

  return { fetch: demoFetch, reset };
}
