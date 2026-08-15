import "server-only";

import fs from "node:fs";
import path from "node:path";
import { writeFileAtomically } from "./atomic-file";
import { loadArticleCategories, loadArticles, normalizeCategoryName, type Article } from "./article-store";

const accessDirectory = path.join(process.cwd(), "access");
const articlesDirectory = path.join(process.cwd(), "articles");
const maximumUploadBytes = 20 * 1024 * 1024;
const accessMimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
]);

export type AccessFileInfo = {
  path: string;
  size: number;
  url: string;
};

export type UploadResult = {
  kind: "article" | "access";
  sourcePath: string;
  url?: string;
  articles: Article[];
  categories: string[];
  accessFiles: AccessFileInfo[];
};

function safePathSegment(value: string) {
  const segment = value.trim();
  if (!segment || segment === "." || segment === "..") return null;
  if (/[<>:"|?*\u0000-\u001f]/.test(segment) || /[. ]$/.test(segment)) return null;
  return segment;
}

function targetSegments(value: string) {
  const normalized = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^(?:\.\/|~\/|\/)+/, "");
  if (!normalized) return null;
  const segments = normalized.split("/").filter(Boolean);
  return segments.every((segment) => safePathSegment(segment)) ? segments : null;
}

function sourceFileName(file: File) {
  return safePathSegment(file.name.replaceAll("\\", "/").split("/").at(-1) || "");
}

function ensureInside(root: string, destination: string) {
  const relative = path.relative(root, destination);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function accessUrl(relativePath: string) {
  return `/access/${relativePath
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function matchesImageSignature(extension: string, bytes: Buffer) {
  if (extension === ".png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === ".jpg" || extension === ".jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === ".gif") return ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
  if (extension === ".webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (extension === ".avif") {
    const brand = bytes.subarray(4, 12).toString("ascii");
    return brand === "ftypavif" || brand === "ftypavis";
  }
  return false;
}

export function loadAccessFiles(): AccessFileInfo[] {
  if (!fs.existsSync(accessDirectory)) return [];
  const files: AccessFileInfo[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) {
        const relativePath = path.relative(accessDirectory, absolutePath);
        files.push({
          path: relativePath.split(path.sep).join("/"),
          size: fs.statSync(absolutePath).size,
          url: accessUrl(relativePath),
        });
      }
    }
  };
  visit(accessDirectory);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function saveUploadedFile(file: File, requestedTarget: string): Promise<UploadResult> {
  if (file.size > maximumUploadBytes) throw new Error("file exceeds the 20 MB upload limit");
  const sourceName = sourceFileName(file);
  const segments = targetSegments(requestedTarget);
  if (!sourceName || !segments) throw new Error("invalid upload path");
  const bytes = Buffer.from(await file.arrayBuffer());

  if (segments[0].toLowerCase() === "articles") {
    if (segments.length < 2 || segments.length > 3) {
      throw new Error("articles target must be articles/<category>[/<file>.md]");
    }
    if (path.extname(sourceName).toLowerCase() !== ".md") throw new Error("articles only accepts Markdown files");
    const category = normalizeCategoryName(segments[1]);
    if (!category) throw new Error("invalid article category");
    const destinationName = segments.length === 3 ? safePathSegment(segments[2]) : sourceName;
    if (!destinationName || path.extname(destinationName).toLowerCase() !== ".md") {
      throw new Error("article destination must end in .md");
    }
    const destination = path.join(articlesDirectory, category, destinationName);
    if (!ensureInside(articlesDirectory, destination)) throw new Error("article target is outside the whitelist");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination)) throw new Error("article destination already exists");
    writeFileAtomically(destination, bytes);
    return {
      kind: "article",
      sourcePath: path.relative(process.cwd(), destination),
      articles: loadArticles(),
      categories: loadArticleCategories(),
      accessFiles: loadAccessFiles(),
    };
  }

  if (segments[0].toLowerCase() !== "access") throw new Error("upload target must start with articles/ or access/");
  const sourceExtension = path.extname(sourceName).toLowerCase();
  const expectedMimeType = accessMimeTypes.get(sourceExtension);
  if (
    !expectedMimeType ||
    (file.type && file.type !== expectedMimeType && file.type !== "application/octet-stream") ||
    !matchesImageSignature(sourceExtension, bytes)
  ) {
    throw new Error("access only accepts PNG, JPEG, GIF, WebP, or AVIF images");
  }
  const accessSegments = segments.slice(1);
  const requestedExtension = path.extname(accessSegments.at(-1) || "").toLowerCase();
  let destinationName = sourceName;
  let directorySegments = accessSegments;
  if (requestedExtension) {
    if (!accessMimeTypes.has(requestedExtension)) throw new Error("unsupported access image extension");
    if (requestedExtension !== sourceExtension)
      throw new Error("access destination must keep the source image extension");
    destinationName = accessSegments.at(-1) as string;
    directorySegments = accessSegments.slice(0, -1);
  }
  const destination = path.join(accessDirectory, ...directorySegments, destinationName);
  if (!ensureInside(accessDirectory, destination)) throw new Error("access target is outside the whitelist");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) throw new Error("access destination already exists");
  writeFileAtomically(destination, bytes);
  const relativePath = path.relative(accessDirectory, destination);
  return {
    kind: "access",
    sourcePath: path.relative(process.cwd(), destination),
    url: accessUrl(relativePath),
    articles: loadArticles(),
    categories: loadArticleCategories(),
    accessFiles: loadAccessFiles(),
  };
}

export function readAccessFile(segments: string[]) {
  if (!segments.length || !segments.every((segment) => safePathSegment(segment))) return null;
  const destination = path.join(accessDirectory, ...segments);
  if (
    !ensureInside(accessDirectory, destination) ||
    !fs.existsSync(destination) ||
    !fs.statSync(destination).isFile()
  ) {
    return null;
  }
  const mimeType = accessMimeTypes.get(path.extname(destination).toLowerCase());
  if (!mimeType) return null;
  return { bytes: fs.readFileSync(destination), mimeType };
}

export function removeAccessFile(requestedPath: string) {
  const segments = targetSegments(requestedPath);
  if (!segments || segments[0].toLowerCase() !== "access" || segments.length < 2) return false;
  const destination = path.join(accessDirectory, ...segments.slice(1));
  if (
    !ensureInside(accessDirectory, destination) ||
    !fs.existsSync(destination) ||
    !fs.statSync(destination).isFile()
  ) {
    return false;
  }
  fs.rmSync(destination);
  let parent = path.dirname(destination);
  while (parent !== accessDirectory && fs.readdirSync(parent).length === 0) {
    fs.rmdirSync(parent);
    parent = path.dirname(parent);
  }
  return true;
}
