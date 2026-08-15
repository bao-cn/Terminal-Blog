import "server-only";

import { openDatabase } from "./database";

export function readSystemConfig() {
  const database = openDatabase();
  try {
    const row = database.prepare("SELECT value FROM system_config WHERE key = 'site.config'").get() as
      { value: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.value) as unknown;
    } catch {
      return null;
    }
  } finally {
    database.close();
  }
}

export function writeSystemConfig(value: unknown) {
  const database = openDatabase();
  try {
    database
      .prepare(
        `INSERT INTO system_config (key, value, updated_at) VALUES ('site.config', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      )
      .run(JSON.stringify(value), new Date().toISOString());
  } finally {
    database.close();
  }
}
