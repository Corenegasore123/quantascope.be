import {
  executeRule,
  getRuleById,
  normalizeToMetres,
  type DetectedMeasurement,
  type VariableMapping,
} from "@auto-measure/calculation-engine";

const LABEL_MAP: Record<string, string> = {
  l: "length",
  w: "width",
  h: "height",
  d: "depth",
  b: "breadth",
  t: "wall_thickness",
};

const SPATIAL_HINTS: Record<string, string[]> = {
  external_length: ["length", "long", "l"],
  external_width: ["width", "short", "w"],
  wall_thickness: ["thickness", "t", "wall"],
  breadth: ["breadth", "b", "offset"],
  height_or_depth: ["height", "depth", "h", "d"],
};

export interface RawMeasurement {
  id: string;
  value: number;
  unit: string;
  rawText: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  label?: string;
}

export function mapMeasurementsToVariables(
  measurements: RawMeasurement[],
  requiredVariables: string[] = [
    "external_length",
    "external_width",
    "wall_thickness",
    "breadth",
    "height_or_depth",
  ]
): VariableMapping {
  const variables: VariableMapping["variables"] = {};
  const used = new Set<string>();
  const ambiguousMappings: VariableMapping["ambiguousMappings"] = [];

  for (const measurement of measurements) {
    const normalizedValue = normalizeToMetres(measurement.value, measurement.unit);

    if (measurement.label) {
      const varName = LABEL_MAP[measurement.label.toLowerCase()];
      if (varName && requiredVariables.includes(varName)) {
        if (variables[varName]) {
          ambiguousMappings.push({
            variable: varName,
            candidates: [variables[varName].sourceMeasurementId, measurement.id],
          });
        } else {
          variables[varName] = {
            value: normalizedValue,
            unit: "m",
            confidence: measurement.confidence,
            sourceMeasurementId: measurement.id,
          };
          used.add(measurement.id);
        }
      }
    }
  }

  const remaining = measurements.filter((m) => !used.has(m.id));
  const unassignedVars = requiredVariables.filter((v) => !variables[v]);

  const sorted = [...remaining].sort((a, b) => b.value - a.value);
  for (let i = 0; i < unassignedVars.length && i < sorted.length; i++) {
    const varName = unassignedVars[i];
    const m = sorted[i];
    variables[varName] = {
      value: normalizeToMetres(m.value, m.unit),
      unit: "m",
      confidence: m.confidence * 0.85,
      sourceMeasurementId: m.id,
    };
    used.add(m.id);
  }

  return {
    variables,
    unmappedMeasurements: measurements.filter((m) => !used.has(m.id)).map((m) => m.id),
    ambiguousMappings,
  };
}

export interface CalculationPlan {
  workItem: string;
  method: "long_short_wall" | "centre_line";
  steps: Array<{ ruleId: string; inputs: Record<string, number> }>;
}

export function buildEarthworkExcavationPlan(
  mapping: VariableMapping,
  method: "long_short_wall" | "centre_line" = "centre_line"
): CalculationPlan | null {
  const v = mapping.variables;
  const externalLength = v.external_length?.value;
  const externalWidth = v.external_width?.value;
  const wallThickness = v.wall_thickness?.value ?? 0.4;
  const breadth = v.breadth?.value ?? v.offset?.value ?? 0.8;
  const depth = v.height_or_depth?.value ?? v.depth?.value;

  if (!externalLength || !externalWidth || !depth) return null;

  const cToCLong = executeRule(getRuleById("RULE-GEO-001")!, {
    external_length: externalLength,
    wall_thickness: wallThickness,
  }).result;

  const cToCShort = executeRule(getRuleById("RULE-GEO-002")!, {
    external_width: externalWidth,
    wall_thickness: wallThickness,
  }).result;

  if (method === "centre_line") {
    const totalCl = executeRule(getRuleById("RULE-GEO-005")!, {
      c_to_c_long: cToCLong,
      c_to_c_short: cToCShort,
    }).result;

    return {
      workItem: "earthwork_excavation",
      method: "centre_line",
      steps: [
        { ruleId: "RULE-GEO-001", inputs: { external_length: externalLength, wall_thickness: wallThickness } },
        { ruleId: "RULE-GEO-002", inputs: { external_width: externalWidth, wall_thickness: wallThickness } },
        { ruleId: "RULE-GEO-005", inputs: { c_to_c_long: cToCLong, c_to_c_short: cToCShort } },
        { ruleId: "RULE-QTY-003", inputs: { total_cl: totalCl, breadth, height_or_depth: depth } },
      ],
    };
  }

  const longWallLength = executeRule(getRuleById("RULE-GEO-003")!, {
    c_to_c_long: cToCLong,
    offset: breadth,
  }).result;

  const shortWallLength = executeRule(getRuleById("RULE-GEO-004")!, {
    c_to_c_short: cToCShort,
    offset: breadth,
  }).result;

  return {
    workItem: "earthwork_excavation",
    method: "long_short_wall",
    steps: [
      { ruleId: "RULE-GEO-001", inputs: { external_length: externalLength, wall_thickness: wallThickness } },
      { ruleId: "RULE-GEO-002", inputs: { external_width: externalWidth, wall_thickness: wallThickness } },
      { ruleId: "RULE-GEO-003", inputs: { c_to_c_long: cToCLong, offset: breadth } },
      { ruleId: "RULE-GEO-004", inputs: { c_to_c_short: cToCShort, offset: breadth } },
      {
        ruleId: "RULE-QTY-002",
        inputs: {
          long_wall_count: 2,
          long_wall_length: longWallLength,
          short_wall_count: 2,
          short_wall_length: shortWallLength,
          breadth,
          height_or_depth: depth,
        },
      },
    ],
  };
}

export function selectCalculationPlan(mapping: VariableMapping): CalculationPlan | null {
  return buildEarthworkExcavationPlan(mapping, "centre_line");
}
