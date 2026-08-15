import { readAccessFile } from "@/lib/upload-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const file = readAccessFile(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Length": String(file.bytes.length),
      "Content-Type": file.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
