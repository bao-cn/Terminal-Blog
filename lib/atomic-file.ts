import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function writeFileAtomically(destination: string, data: string | Buffer) {
  const directory = path.dirname(destination);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(destination)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`,
  );
  const file = fs.openSync(temporary, "w", 0o644);
  try {
    fs.writeFileSync(file, data);
    fs.fsyncSync(file);
    fs.closeSync(file);
    fs.renameSync(temporary, destination);
    try {
      const directoryHandle = fs.openSync(directory, "r");
      try {
        fs.fsyncSync(directoryHandle);
      } finally {
        fs.closeSync(directoryHandle);
      }
    } catch {
      // Directory fsync is not supported on every platform.
    }
  } catch (error) {
    try {
      fs.closeSync(file);
    } catch {
      // Preserve the original write error.
    }
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}
