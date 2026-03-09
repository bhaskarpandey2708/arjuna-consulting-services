import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..", "..");

export function timestampSlug(date = new Date()) {
  return date.toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "_").replace("Z", "Z");
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(filePath, value) {
  await writeFile(filePath, value, "utf8");
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeArtifact(baseDir, fileStem, payload) {
  await ensureDir(baseDir);
  const filePath = path.join(baseDir, `${fileStem}.json`);
  await writeJson(filePath, payload);
  return filePath;
}

export async function findLatestCaptureDir(baseDir) {
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    const latest = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left))[0];

    return latest ? path.join(baseDir, latest) : null;
  } catch {
    return null;
  }
}

export function buildFetchMetadata(response, url) {
  return {
    url,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries())
  };
}
