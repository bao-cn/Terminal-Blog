import { z } from "zod";
import {
  authCookie,
  clearAuthAttempts,
  clientAddress,
  createRootSessionToken,
  expiredAuthCookie,
  requestHasRootAccess,
  reserveAuthAttempt,
  revokeRootSession,
  updateRootPassword,
  verifyRootPassword,
} from "@/lib/auth-store";
import { assertSameOrigin, jsonError, readJsonBody } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({ password: z.string().max(256), session: z.boolean().optional() }).strict();
const passwordSchema = z.object({ password: z.string().min(16).max(256) }).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = loginSchema.parse(await readJsonBody(request, 8 * 1024));
    const decision = reserveAuthAttempt(clientAddress(request));
    if (!decision.allowed) {
      return Response.json(
        { ok: false, error: "too many authentication attempts" },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(decision.retryAfter) } },
      );
    }
    const ok = await verifyRootPassword(body.password);
    if (!ok) {
      return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    clearAuthAttempts(clientAddress(request));
    const token = createRootSessionToken();
    if (!token)
      return jsonError(new Error("root credential is not configured"), "root credential is not configured", 503);
    const createSession = body.session !== false;
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (createSession) headers.set("Set-Cookie", authCookie(token));
    return Response.json({ ok: true, token: createSession ? undefined : token }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError)
      return jsonError(new Error("invalid authentication request"), "invalid authentication request", 422);
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    revokeRootSession(request);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": expiredAuthCookie() } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    if (!requestHasRootAccess(request))
      return jsonError(new Error("root session required"), "root session required", 403);
    const { password } = passwordSchema.parse(await readJsonBody(request, 8 * 1024));
    await updateRootPassword(password);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": expiredAuthCookie() } });
  } catch (error) {
    if (error instanceof z.ZodError)
      return jsonError(
        new Error("password must contain 16 to 256 characters"),
        "password must contain 16 to 256 characters",
        422,
      );
    return jsonError(error);
  }
}
