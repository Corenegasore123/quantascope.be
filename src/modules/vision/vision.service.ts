import type { CVMeasurement, CVProvenance, VisionExtractionResult } from "./types.js";

const CV_SERVICE_URL = process.env.CV_SERVICE_URL ?? "http://localhost:8000";
const CV_TIMEOUT_MS = parseInt(process.env.CV_TIMEOUT_MS ?? "120000", 10);
const CV_RETRY_ATTEMPTS = parseInt(process.env.CV_RETRY_ATTEMPTS ?? "2", 10);

interface RawCVResponse {
  measurements: CVMeasurement[];
  warnings: string[];
  preprocessed: boolean;
  metadata?: {
    provider?: string;
    pipeline_version?: string;
    preprocessing_ops?: string[];
    fallback_used?: boolean;
    ocr_provider?: string;
  };
}

async function callOnce(
  imageBuffer: Buffer,
  filename: string,
  imageId: string,
  mimeType: string
): Promise<RawCVResponse> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)]);
  formData.append("file", blob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CV_TIMEOUT_MS);

  try {
    const response = await fetch(`${CV_SERVICE_URL}/process?image_id=${imageId}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      headers: mimeType ? { "X-Content-Type": mimeType } : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CV service error: ${response.status} ${text}`);
    }

    return (await response.json()) as RawCVResponse;
  } finally {
    clearTimeout(timer);
  }
}

function toProvenance(raw: RawCVResponse): CVProvenance {
  const meta = raw.metadata ?? {};
  return {
    provider: meta.ocr_provider ?? meta.provider ?? "unknown",
    pipelineVersion: meta.pipeline_version ?? "1.0.0",
    preprocessed: raw.preprocessed,
    preprocessingOps: meta.preprocessing_ops ?? [],
    fallbackUsed: meta.fallback_used ?? false,
  };
}

export async function extractVisionMeasurements(
  imageBuffer: Buffer,
  filename: string,
  imageId: string,
  mimeType: string
): Promise<VisionExtractionResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= CV_RETRY_ATTEMPTS; attempt++) {
    try {
      const raw = await callOnce(imageBuffer, filename, imageId, mimeType);
      return {
        measurements: raw.measurements ?? [],
        warnings: raw.warnings ?? [],
        provenance: toProvenance(raw),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < CV_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  if (process.env.ALLOW_MOCK_CV === "true") {
    return {
      measurements: [],
      warnings: [`CV service unavailable after ${CV_RETRY_ATTEMPTS} attempts: ${lastError?.message}`],
      provenance: {
        provider: "mock",
        pipelineVersion: "0.0.0",
        preprocessed: false,
        preprocessingOps: [],
        fallbackUsed: false,
      },
    };
  }

  throw lastError ?? new Error("CV service unavailable");
}

export async function checkCVServiceHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${CV_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "ok" || data.status === "degraded";
  } catch {
    return false;
  }
}
