import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { repoRoot } from "../config/env.js";

function storageRoot(): string {
  if (process.env.STORAGE_PATH) {
    return path.isAbsolute(process.env.STORAGE_PATH)
      ? process.env.STORAGE_PATH
      : path.resolve(repoRoot, process.env.STORAGE_PATH);
  }
  return path.join(repoRoot, "storage");
}

export async function ensureStorageDir(): Promise<string> {
  const root = storageRoot();
  await mkdir(root, { recursive: true });
  await mkdir(path.join(root, "images"), { recursive: true });
  await mkdir(path.join(root, "reports"), { recursive: true });
  return root;
}

export async function saveFile(
  subdir: string,
  filename: string,
  data: Buffer
): Promise<string> {
  await ensureStorageDir();
  const dir = path.join(storageRoot(), subdir);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, data);
  return filePath;
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
