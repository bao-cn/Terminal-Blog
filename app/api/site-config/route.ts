import { readSiteConfig } from "@/lib/site-config-server";
import { mergeSiteConfig } from "@/lib/site-config";
import { requestHasRootAccess } from "@/lib/auth-store";
import { writeSystemConfig } from "@/lib/config-store";
import { assertSameOrigin, jsonError as secureJsonError, readJsonBody } from "@/lib/request-security";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteConfigSchema = z
  .object({
    blogName: z.string().max(160).optional(),
    contactEmail: z.string().max(320).optional(),
    description: z.string().max(4000).optional(),
    titleTemplate: z.string().max(320).optional(),
    favicon: z.string().max(512).optional(),
    sourceFallback: z.string().max(256).optional(),
    filings: z.object({ icp: z.string().max(256).optional(), police: z.string().max(256).optional() }).optional(),
    friendlyLinks: z
      .array(z.object({ label: z.string().max(160), href: z.string().url().max(2048) }).strict())
      .max(32)
      .optional(),
    cookieNotice: z.string().max(1000).optional(),
  })
  .strict();

export function GET() {
  const { config, md5 } = readSiteConfig();
  return Response.json(config, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Site-Config-MD5": md5,
    },
  });
}

async function save(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return secureJsonError(error);
  }
  if (!requestHasRootAccess(request)) {
    return Response.json({ ok: false, error: "root session required" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = siteConfigSchema.parse(await readJsonBody(request, 64 * 1024));
  } catch (error) {
    return secureJsonError(
      error instanceof z.ZodError ? new Error("invalid configuration fields") : error,
      "invalid configuration fields",
      error instanceof z.ZodError ? 422 : undefined,
    );
  }
  const config = mergeSiteConfig(body);
  writeSystemConfig(config);
  const current = readSiteConfig();
  return Response.json(
    { ok: true, config: current.config },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Site-Config-MD5": current.md5,
      },
    },
  );
}

export const POST = save;
export const PUT = save;
