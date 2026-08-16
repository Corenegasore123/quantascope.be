export type UnitCategory = "length" | "area" | "volume" | "currency" | "count" | "ratio";

export interface VariableDefinition {
  id: string;
  unit: string;
  description?: string;
  min?: number;
  default?: number;
}

export interface ValidationRule {
  type: "positive" | "non_negative" | "non_zero" | "less_than";
  field: string;
  reference?: string;
}

export interface FormulaDefinition {
  expression: string;
  latex: string;
}

export interface CalculationRule {
  id: string;
  name: string;
  description?: string;
  category: "geometry" | "quantity" | "cost";
  method: "long_short_wall" | "centre_line" | "direct" | "deduction" | "costing";
  requiredVariables: VariableDefinition[];
  optionalVariables?: VariableDefinition[];
  formula: FormulaDefinition;
  outputUnit: string;
  validationRules?: ValidationRule[];
  workItems?: string[];
  notes?: string;
}

export interface CalculationInputs {
  [key: string]: number;
}

export interface CalculationStep {
  ruleId: string;
  ruleName: string;
  formula: string;
  latex: string;
  inputs: CalculationInputs;
  result: number;
  unit: string;
}

export interface CalculationResult {
  ruleId: string;
  ruleName: string;
  result: number;
  unit: string;
  steps: CalculationStep[];
  validation: ValidationMessage[];
  confidence?: number;
}

export interface ValidationMessage {
  level: "valid" | "warning" | "error";
  code: string;
  message: string;
  field?: string;
}

export interface DetectedMeasurement {
  id: string;
  value: number;
  unit: string;
  rawText: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  label?: string;
  sourceImageId: string;
}

export interface MappedVariable {
  value: number;
  unit: string;
  confidence: number;
  sourceMeasurementId: string;
}

export interface VariableMapping {
  variables: Record<string, MappedVariable>;
  unmappedMeasurements: string[];
  ambiguousMappings: Array<{ variable: string; candidates: string[] }>;
}

export type JobStatus =
  | "UPLOADING"
  | "PROCESSING_IMAGE"
  | "EXTRACTING_MEASUREMENTS"
  | "INTERPRETING_DIAGRAM"
  | "VALIDATING"
  | "CALCULATING"
  | "COMPLETED"
  | "FAILED";
