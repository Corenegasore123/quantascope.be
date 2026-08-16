export interface StoredObject {
  key: string;
  sizeBytes: number;
}

export interface UploadIntent {
  /** Provider-specific upload target (URL or path hint) */
  uploadUrl: string;
  /** Fields the client must include (S3 POST policy fields, etc.) */
  fields?: Record<string, string>;
  /** Document id reserved for this upload */
  documentId: string;
  /** How the client should upload */
  method: "direct" | "put" | "post";
  expiresAt: string;
}

export interface StorageProvider {
  save(subdir: string, filename: string, data: Buffer): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  /** Create a upload intent — local provider uses direct API upload */
  createUploadIntent(
    subdir: string,
    filename: string,
    options: { documentId: string; mimeType: string; sizeBytes: number }
  ): Promise<UploadIntent>;
}
