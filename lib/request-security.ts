const defaultHeaders = { "Cache-Control": "no-store" };

export class RequestSecurityError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "RequestSecurityError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function contentLength(request: Request) {
  const value = request.headers.get("content-length");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function readLimitedBody(request: Request, maxBytes: number) {
  const declared = contentLength(request);
  if (declared !== null && declared > maxBytes) throw new RequestSecurityError("request body is too large", 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestSecurityError("request body is too large", 413);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readJsonBody<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new RequestSecurityError("content-type must be application/json", 415);
  const bytes = await readLimitedBody(request, maxBytes);
  if (!bytes.byteLength) throw new RequestSecurityError("request body is required", 400);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new RequestSecurityError("invalid JSON body", 400);
  }
}

export async function readFormDataBody(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "multipart/form-data") {
    throw new RequestSecurityError("content-type must be multipart/form-data", 415);
  }
  const bytes = await readLimitedBody(request, maxBytes);
  return new Request(request.url, { method: request.method, headers: request.headers, body: bytes }).formData();
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let expected: string;
  try {
    expected = new URL(request.url).origin;
    if (new URL(origin).origin !== expected) throw new RequestSecurityError("origin is not allowed", 403);
  } catch (error) {
    if (error instanceof RequestSecurityError) throw error;
    throw new RequestSecurityError("invalid origin", 403);
  }
}

export function jsonError(error: unknown, fallback = "request failed", overrideStatus?: number) {
  const security = error instanceof RequestSecurityError ? error : null;
  const response = Response.json(
    { ok: false, error: security?.message || (error instanceof Error ? error.message : fallback) },
    {
      status: overrideStatus || security?.status || 400,
      headers: {
        ...defaultHeaders,
        ...(security?.retryAfter ? { "Retry-After": String(security.retryAfter) } : {}),
      },
    },
  );
  return response;
}
