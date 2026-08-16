export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CVMeasurement {
  id: string;
  value: number;
  unit: string;
  raw_text: string;
  confidence: number;
  bounding_box: BoundingBox;
  label?: string | null;
}

export interface CVProvenance {
  provider: string;
  pipelineVersion: string;
  preprocessed: boolean;
  preprocessingOps: string[];
  fallbackUsed: boolean;
}

export interface VisionExtractionResult {
  measurements: CVMeasurement[];
  warnings: string[];
  provenance: CVProvenance;
}
