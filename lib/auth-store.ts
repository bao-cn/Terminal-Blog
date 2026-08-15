import "server-only";

import crypto from "node:crypto";
import { promisify } from "node:util";
import { openDatabase } from "./database";
import { sessionIsActive, type SessionRecord } from "./auth-policy";
import { resolveBootstrapRootPassword } from "./auth-config";

const scryptAsync = promisify(crypto.scrypt);
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
const maximumClockSkewMs = 30 * 1000;
const authCookieName = "terminal_root";

type CredentialRow = { salt: string; digest: string; password_version: number };
type RateLimitScope = { key: string; limit: number; windowMs: number; blockMs: number };

function hashPassword(password: string, salt: Buffer) {
  return scryptAsync(password, salt, 64).then((value) => Buffer.from(value as Buffer).toString("hex"));
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getCredential(database: ReturnType<typeof openDatabase>) {
  return database.prepare("SELECT salt, digest, password_version FROM credentials WHERE key = 'root'").get() as
    CredentialRow | undefined;
}

async function ensureRootCredential(database: ReturnType<typeof openDatabase>) {
  const existing = getCredential(database);
  if (existing) return existing;
  const password = resolveBootstrapRootPassword();
  const salt = crypto.randomBytes(16);
  const digest = await hashPassword(password, salt);
  database
    .prepare(
      "INSERT OR IGNORE INTO credentials (key, salt, digest, password_version, updated_at) VALUES ('root', ?, ?, 1, ?)",
    )
    .run(salt.toString("hex"), digest, new Date().toISOString());
  return getCredential(database);
}

export function isRootCredentialConfigured() {
  const database = openDatabase();
  try {
    return Boolean(getCredential(database) || resolveBootstrapRootPassword());
  } finally {
    database.close();
  }
}

export async function verifyRootPassword(password: string) {
  const database = openDatabase();
  try {
    const credential = await ensureRootCredential(database);
    if (!credential) return false;
    const digest = await hashPassword(password, Buffer.from(credential.salt, "hex"));
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(credential.digest, "hex"));
  } finally {
    database.close();
  }
}

function rateLimitHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function consumeRateLimit(database: ReturnType<typeof openDatabase>, scope: RateLimitScope, now: number) {
  const row = database
    .prepare("SELECT window_started_at, attempts, blocked_until FROM auth_rate_limits WHERE key = ?")
    .get(scope.key) as { window_started_at: number; attempts: number; blocked_until: number } | undefined;
  if (row?.blocked_until && row.blocked_until > now) {
    return { allowed: false, retryAfter: Math.ceil((row.blocked_until - now) / 1000) };
  }
  const windowExpired = !row || now - row.window_started_at >= scope.windowMs;
  const attempts = windowExpired ? 1 : row.attempts + 1;
  if (attempts > scope.limit) {
    const overflow = attempts - scope.limit;
    const blockedUntil = now + Math.min(scope.blockMs * 2 ** Math.min(overflow - 1, 5), 15 * 60 * 1000);
    database
      .prepare(
        `INSERT INTO auth_rate_limits (key, window_started_at, attempts, blocked_until)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts, blocked_until=excluded.blocked_until`,
      )
      .run(scope.key, windowExpired ? now : row.window_started_at, attempts, blockedUntil);
    return { allowed: false, retryAfter: Math.ceil((blockedUntil - now) / 1000) };
  }
  database
    .prepare(
      `INSERT INTO auth_rate_limits (key, window_started_at, attempts, blocked_until)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(key) DO UPDATE SET window_started_at=excluded.window_started_at, attempts=excluded.attempts, blocked_until=0`,
    )
    .run(scope.key, windowExpired ? now : row.window_started_at, attempts);
  return { allowed: true, retryAfter: 0 };
}

export function reserveAuthAttempt(identifier: string) {
  const database = openDatabase();
  const now = Date.now();
  const scopes: RateLimitScope[] = [
    { key: "global", limit: 60, windowMs: 60 * 1000, blockMs: 10 * 1000 },
    { key: `ip:${rateLimitHash(identifier || "unknown")}`, limit: 5, windowMs: 15 * 60 * 1000, blockMs: 30 * 1000 },
  ];
  try {
    database.exec("BEGIN IMMEDIATE");
    for (const scope of scopes) {
      const decision = consumeRateLimit(database, scope, now);
      if (!decision.allowed) {
        database.exec("COMMIT");
        return decision;
      }
    }
    database.exec("COMMIT");
    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }
    throw error;
  } finally {
    database.close();
  }
}

export function clearAuthAttempts(identifier: string) {
  const database = openDatabase();
  try {
    database.prepare("DELETE FROM auth_rate_limits WHERE key = ?").run(`ip:${rateLimitHash(identifier || "unknown")}`);
  } finally {
    database.close();
  }
}

export function createRootSessionToken() {
  const database = openDatabase();
  try {
    const credential = getCredential(database);
    if (!credential) return null;
    const token = crypto.randomBytes(32).toString("base64url");
    const now = Date.now();
    database
      .prepare(
        "INSERT INTO auth_sessions (token_hash, created_at, expires_at, password_version, revoked_at) VALUES (?, ?, ?, ?, NULL)",
      )
      .run(hashSessionToken(token), now, now + sessionLifetimeMs, credential.password_version);
    database.prepare("DELETE FROM auth_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL").run(now);
    return token;
  } finally {
    database.close();
  }
}

function tokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearerToken) return bearerToken;
  return (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${authCookieName}=`))
    ?.slice(authCookieName.length + 1);
}

export function requestHasRootAccess(request: Request) {
  const token = tokenFromRequest(request);
  if (!token) return false;
  const database = openDatabase();
  try {
    const now = Date.now();
    const row = database
      .prepare(
        `SELECT s.created_at, s.expires_at, s.revoked_at, s.password_version, c.password_version AS current_password_version
         FROM auth_sessions s CROSS JOIN credentials c
         WHERE s.token_hash = ? AND c.key = 'root'`,
      )
      .get(hashSessionToken(token)) as SessionRecord | undefined;
    return sessionIsActive(row, now, maximumClockSkewMs);
  } finally {
    database.close();
  }
}

export function revokeRootSession(request: Request) {
  const token = tokenFromRequest(request);
  if (!token) return;
  const database = openDatabase();
  try {
    database
      .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?")
      .run(Date.now(), hashSessionToken(token));
  } finally {
    database.close();
  }
}

export async function updateRootPassword(password: string) {
  const database = openDatabase();
  try {
    const credential = getCredential(database);
    if (!credential) throw new Error("root credential is not configured");
    const salt = crypto.randomBytes(16);
    const digest = await hashPassword(password, salt);
    database.exec("BEGIN IMMEDIATE");
    database
      .prepare(
        `UPDATE credentials
         SET salt = ?, digest = ?, password_version = password_version + 1, updated_at = ?
         WHERE key = 'root'`,
      )
      .run(salt.toString("hex"), digest, new Date().toISOString());
    database.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE revoked_at IS NULL").run(Date.now());
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    database.close();
  }
}

export function authCookie(token: string, maxAge = Math.floor(sessionLifetimeMs / 1000)) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${authCookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function expiredAuthCookie() {
  return authCookie("", 0);
}

export function clientAddress(request: Request) {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}
