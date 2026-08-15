import { requestHasRootAccess } from "@/lib/auth-store";
import { searchArticleIndex } from "@/lib/article-index-store";
import { loadArticles, moveArticleFile, removeArticleFile, writeArticleFile, type Article } from "@/lib/article-store";
import { assertSameOrigin, jsonError as secureJsonError, readJsonBody } from "@/lib/request-security";
import { articleMoveSchema, articleWriteSchema } from "@/lib/api-schemas";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return secureJsonError(new Error(message), message, status);
}

export function GET(request: Request) {
  loadArticles();
  const url = new URL(request.url);
  const rows = searchArticleIndex({
    query: url.searchParams.get("q") || undefined,
    tag: url.searchParams.get("tag") || undefined,
    category: url.searchParams.get("category") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  });
  return Response.json({ ok: true, rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  let body: Partial<Article> & { previousSourcePath?: string };
  try {
    body = articleWriteSchema.parse(await readJsonBody(request, 512 * 1024));
  } catch (error) {
    return secureJsonError(
      error instanceof z.ZodError ? new Error("invalid article fields") : error,
      "invalid article fields",
      error instanceof z.ZodError ? 422 : undefined,
    );
  }
  if (!body.id || !body.category || !body.title) return jsonError("id, category, and title are required");
  const article: Article = {
    id: body.id,
    title: body.title,
    category: body.category,
    date: body.date || new Date().toISOString().slice(0, 10),
    readTime: body.readTime || "3 min",
    excerpt: body.excerpt || "",
    content: body.content || "",
    tags: Array.isArray(body.tags) ? body.tags : [],
    pinyin: body.pinyin || "",
  };
  let sourcePath: string;
  try {
    sourcePath = writeArticleFile(article, body.previousSourcePath);
  } catch (error) {
    return jsonError(
      error instanceof Error && (error as Error & { code?: string }).code === "EEXIST"
        ? "article already exists"
        : "article write failed",
      error instanceof Error && (error as Error & { code?: string }).code === "EEXIST" ? 409 : 500,
    );
  }
  loadArticles();
  return Response.json({ ok: true, article: { ...article, sourcePath } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  let body: { id?: string; category?: string };
  try {
    body = articleMoveSchema.parse(await readJsonBody(request, 16 * 1024));
  } catch (error) {
    return secureJsonError(
      error instanceof z.ZodError ? new Error("invalid article move fields") : error,
      "invalid article move fields",
      error instanceof z.ZodError ? 422 : undefined,
    );
  }
  if (!body.id || !body.category) return jsonError("id and category are required");
  const article = loadArticles().find((item) => item.id === body.id);
  if (!article) return jsonError("article not found", 404);
  let moved: Article;
  try {
    moved = moveArticleFile(article, body.category);
  } catch (error) {
    const conflict = error instanceof Error && (error as Error & { code?: string }).code === "EEXIST";
    return jsonError(
      conflict ? "article already exists in the target category" : "article move failed",
      conflict ? 409 : 500,
    );
  }
  loadArticles();
  return Response.json({ ok: true, article: moved }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  const id = new URL(request.url).searchParams.get("id") || "";
  const article = loadArticles().find((item) => item.id === id);
  if (!article) return jsonError("article not found", 404);
  removeArticleFile(article);
  loadArticles();
  return Response.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
}
