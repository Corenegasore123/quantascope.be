# Document Processing

Documents are stored as `Image` records with a `DocumentStatus` lifecycle.

## Status flow

```text
UPLOADING → UPLOADED → PROCESSING → PROCESSED
                              ↘ FAILED
```

Status is updated by the analysis pipeline (`src/lib/pipeline.ts`) as jobs progress.

## Upload patterns

### Direct upload (current default)

```http
POST /api/projects/:projectId/documents
Content-Type: multipart/form-data

file=<binary>
```

Creates document, stores file locally, starts analysis job.

### Upload intent (SaaS-ready)

```http
POST /api/projects/:projectId/documents/intent
Content-Type: application/json

{ "filename": "drawing.png", "mimeType": "image/png", "sizeBytes": 102400 }
```

Returns `{ document, upload }` where `upload` contains provider-specific fields.

For local development, `upload.method` is `"direct"` and `upload.uploadUrl` points to:

```http
POST /api/documents/:documentId/upload
```

Future S3/R2 providers can return presigned POST/PUT URLs without changing the client contract.

## Storage abstraction

`StorageProvider` interface in `src/infrastructure/storage/storage.provider.ts`.

Current implementation: `LocalStorageProvider` writes to `STORAGE_PATH` (default `./storage`).

## Supported formats

- JPEG, PNG, WEBP
- PDF (single-page processing via CV service)

Max size: `MAX_UPLOAD_SIZE_MB` (default 20).

## Access control

Documents belong to a project and uploader. Listing and upload require project ownership. Deletion requires document uploader match.

## Related endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/documents` | List project documents |
| GET | `/api/projects/:id/documents/:documentId` | Document detail |
| DELETE | `/api/documents/:id` | Delete document + file |
