import { requestHasRootAccess } from "@/lib/auth-store";
import { findDraft, loadDrafts, publishDraftFile, removeDraftFile, writeDraftFile } from "@/lib/draft-store";
import type { Article } from "@/lib/article-store";
import { assertSameOrigin, jsonError as secureJsonError, readJsonBody } from "@/lib/request-security";
import { articleWriteSchema, draftActionSchema } from "@/lib/api-schemas";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function GET(request: Request) {
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ ok: true, drafts: loadDrafts() }, { headers: { "Cache-Control": "no-store" } });
  }
  const draft = findDraft(id);
  if (!draft) return jsonError("draft not found", 404);
  return Response.json({ ok: true, draft }, { headers: { "Cache-Control": "no-store" } });
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
      error instanceof z.ZodError ? new Error("invalid draft fields") : error,
      "invalid draft fields",
      error instanceof z.ZodError ? 422 : undefined,
    );
  }
  if (!body.id || !body.category || !body.title) return jsonError("id, category, and title are required");
  let draft: Article;
  try {
    draft = writeDraftFile(
      {
        id: body.id,
        title: body.title,
        category: body.category,
        date: body.date || new Date().toISOString().slice(0, 10),
        readTime: body.readTime || "3 min",
        excerpt: body.excerpt || "",
        content: body.content || "",
        tags: Array.isArray(body.tags) ? body.tags : [],
        pinyin: body.pinyin || "",
      },
      body.previousSourcePath,
    );
  } catch (error) {
    const conflict = error instanceof Error && (error as Error & { code?: string }).code === "EEXIST";
    return jsonError(conflict ? "draft already exists" : "draft write failed", conflict ? 409 : 500);
  }
  return Response.json({ ok: true, draft }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  let body: { id?: string };
  try {
    body = draftActionSchema.parse(await readJsonBody(request, 16 * 1024));
  } catch (error) {
    return secureJsonError(
      error instanceof z.ZodError ? new Error("invalid draft id") : error,
      "invalid draft id",
      error instanceof z.ZodError ? 422 : undefined,
    );
  }
  if (!body.id) return jsonError("draft id is required");
  const draft = findDraft(body.id);
  if (!draft) return jsonError("draft not found", 404);
  let article: Article;
  try {
    article = publishDraftFile(draft);
  } catch (error) {
    const conflict = error instanceof Error && (error as Error & { code?: string }).code === "EEXIST";
    return jsonError(conflict ? "article already exists" : "draft publish failed", conflict ? 409 : 500);
  }
  return Response.json({ ok: true, article }, { headers: { "Cache-Control": "no-store" } });
}

export function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  const id = new URL(request.url).searchParams.get("id") || "";
  const draft = findDraft(id);
  if (!draft) return jsonError("draft not found", 404);
  removeDraftFile(draft);
  return Response.json({ ok: true, id: draft.id }, { headers: { "Cache-Control": "no-store" } });
}
