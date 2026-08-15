import { requestHasRootAccess } from "@/lib/auth-store";
import { loadAccessFiles, removeAccessFile, saveUploadedFile } from "@/lib/upload-store";
import { assertSameOrigin, jsonError as secureJsonError, readFormDataBody } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function GET() {
  return Response.json({ ok: true, accessFiles: loadAccessFiles() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  let formData: FormData;
  try {
    formData = await readFormDataBody(request, 21 * 1024 * 1024);
  } catch (error) {
    return secureJsonError(error);
  }
  const file = formData.get("file");
  const targetPath = formData.get("targetPath");
  if (!(file instanceof File) || typeof targetPath !== "string") return jsonError("file and targetPath are required");
  try {
    const result = await saveUploadedFile(file, targetPath);
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "upload failed");
  }
}

export function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) return jsonError("root session required", 403);
  const targetPath = new URL(request.url).searchParams.get("path") || "";
  if (!removeAccessFile(targetPath)) return jsonError("access file not found", 404);
  return Response.json({ ok: true, accessFiles: loadAccessFiles() }, { headers: { "Cache-Control": "no-store" } });
}
