import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { repoRoot } from "../../config/env.js";
import type { StorageProvider, UploadIntent } from "./storage.provider.js";

function storageRoot(): string {
  if (process.env.STORAGE_PATH) {
    return path.isAbsolute(process.env.STORAGE_PATH)
      ? process.env.STORAGE_PATH
      : path.resolve(repoRoot, process.env.STORAGE_PATH);
  }
  return path.join(repoRoot, "storage");
}

export class LocalStorageProvider implements StorageProvider {
  async ensureDir(subdir: string): Promise<string> {
    const dir = path.join(storageRoot(), subdir);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async save(subdir: string, filename: string, data: Buffer): Promise<string> {
    await this.ensureDir(subdir);
    const filePath = path.join(storageRoot(), subdir, filename);
    await writeFile(filePath, data);
    return filePath;
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(storageKey);
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(storageKey);
    } catch {
      // file may already be removed
    }
  }

  async createUploadIntent(
    subdir: string,
    filename: string,
    options: { documentId: string; mimeType: string; sizeBytes: number }
  ): Promise<UploadIntent> {
    const apiBase = process.env.API_PUBLIC_URL ?? "http://localhost:4000";
    return {
      documentId: options.documentId,
      method: "direct",
      uploadUrl: `${apiBase}/api/documents/${options.documentId}/upload`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }
}

let instance: LocalStorageProvider | null = null;

export function getStorage(): LocalStorageProvider {
  if (!instance) instance = new LocalStorageProvider();
  return instance;
}

/** @deprecated Use getStorage().save() */
export async function ensureStorageDir(): Promise<string> {
  const provider = getStorage();
  await provider.ensureDir("images");
  await provider.ensureDir("reports");
  return storageRoot();
}

/** @deprecated Use getStorage().save() */
export async function saveFile(subdir: string, filename: string, data: Buffer): Promise<string> {
  return getStorage().save(subdir, filename, data);
}

/** @deprecated Use getStorage().read() */
export async function readStoredFile(filePath: string): Promise<Buffer> {
  return getStorage().read(filePath);
}
