export type SessionRecord = {
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
  password_version: number;
  current_password_version: number;
};

export function sessionIsActive(record: SessionRecord | undefined, now: number, maximumClockSkewMs = 30_000) {
  return Boolean(
    record &&
    !record.revoked_at &&
    record.created_at <= now + maximumClockSkewMs &&
    record.expires_at > now &&
    record.password_version === record.current_password_version,
  );
}
