import { createArticleCategory, loadArticleCategories, removeEmptyArticleCategory } from "@/lib/article-store";
import { requestHasRootAccess } from "@/lib/auth-store";
import { assertSameOrigin, jsonError as secureJsonError, readJsonBody } from "@/lib/request-security";
import { categorySchema } from "@/lib/api-schemas";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function GET() {
  return Response.json({ ok: true, categories: loadArticleCategories() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  let body: { category?: string };
  try {
    body = categorySchema.parse(await readJsonBody(request, 16 * 1024));
  } catch (error) {
    return secureJsonError(
      error instanceof z.ZodError ? new Error("invalid category") : error,
      "invalid category",
      error instanceof z.ZodError ? 422 : undefined,
    );
  }
  if (!body.category) return jsonError("category is required");
  const category = createArticleCategory(body.category);
  if (!category) return jsonError("invalid category");
  return Response.json({ ok: true, category }, { headers: { "Cache-Control": "no-store" } });
}

export function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  const category = new URL(request.url).searchParams.get("category") || "";
  if (!removeEmptyArticleCategory(category)) return jsonError("category not found or not empty", 409);
  return Response.json({ ok: true, category }, { headers: { "Cache-Control": "no-store" } });
}
