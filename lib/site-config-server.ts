import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { mergeSiteConfig } from "./site-config";
import { readSystemConfig } from "./config-store";

const configPath = path.join(process.cwd(), "config", "site.config.json");

export function readSiteConfig() {
  const raw = fs.readFileSync(configPath, "utf8");
  const fileValue = JSON.parse(raw);
  const databaseValue = readSystemConfig();
  const config = mergeSiteConfig(databaseValue || fileValue);
  const fingerprint = JSON.stringify(config);
  return { config, md5: crypto.createHash("md5").update(fingerprint).digest("hex") };
}
