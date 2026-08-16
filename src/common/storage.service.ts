import { Injectable } from "@nestjs/common";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

@Injectable()
export class StorageService {
  root() {
    const configured = process.env.STORAGE_PATH ?? "./storage";
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }

  async save(subdir: string, filename: string, data: Buffer): Promise<string> {
    const dir = path.join(this.root(), subdir);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await writeFile(filePath, data);
    return filePath;
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await unlink(storagePath);
    } catch {
      /* already gone */
    }
  }
}
