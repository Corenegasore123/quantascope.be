import type {
  CalculationInputs,
  CalculationResult,
  CalculationRule,
  CalculationStep,
  ValidationMessage,
} from "../types/index.js";

const ALLOWED_NAMES = new Set([
  "external_length",
  "external_width",
  "wall_thickness",
  "c_to_c_long",
  "c_to_c_short",
  "offset",
  "long_wall_count",
  "short_wall_count",
  "long_wall_length",
  "short_wall_length",
  "gross_cl",
  "junction_count",
  "junction_correction",
  "number",
  "length",
  "breadth",
  "height_or_depth",
  "height",
  "total_cl",
  "gross_quantity",
  "total_deductions",
  "quantity",
  "rate",
  "subtotal",
  "contingency_rate",
  "wce_rate",
  "contingencies",
  "wce",
  "grand_total",
  "plinth_length",
  "plinth_width",
]);

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function tokenize(expression: string): string[] {
  return expression
    .replace(/\s+/g, "")
    .replace(/([+\-*/()])/g, " $1 ")
    .trim()
    .split(/\s+/);
}

function evaluateExpression(expression: string, inputs: CalculationInputs): number {
  const tokens = tokenize(expression);
  let pos = 0;

  function parseExpression(): number {
    let value = parseTerm();
    while (pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
      const op = tokens[pos++];
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/")) {
      const op = tokens[pos++];
      const right = parseFactor();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseFactor(): number {
    if (tokens[pos] === "(") {
      pos++;
      const value = parseExpression();
      if (tokens[pos] !== ")") throw new Error("Missing closing parenthesis");
      pos++;
      return value;
    }
    const token = tokens[pos++];
    const num = Number(token);
    if (!Number.isNaN(num)) return num;
    if (!ALLOWED_NAMES.has(token)) {
      throw new Error(`Unknown variable: ${token}`);
    }
    if (!(token in inputs)) {
      throw new Error(`Missing input: ${token}`);
    }
    return inputs[token];
  }

  const result = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token: ${tokens[pos]}`);
  }
  return result;
}

function applyDefaults(rule: CalculationRule, inputs: CalculationInputs): CalculationInputs {
  const resolved = { ...inputs };
  for (const variable of rule.requiredVariables) {
    if (!(variable.id in resolved) && variable.default !== undefined) {
      resolved[variable.id] = variable.default;
    }
  }
  return resolved;
}

function validateInputs(rule: CalculationRule, inputs: CalculationInputs): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  for (const variable of rule.requiredVariables) {
    if (!(variable.id in inputs) && variable.default === undefined) {
      messages.push({
        level: "error",
        code: "MISSING_VARIABLE",
        message: `Required variable '${variable.id}' is missing`,
        field: variable.id,
      });
    } else if (variable.id in inputs && variable.min !== undefined && inputs[variable.id] < variable.min) {
      messages.push({
        level: "error",
        code: "BELOW_MINIMUM",
        message: `'${variable.id}' must be >= ${variable.min}`,
        field: variable.id,
      });
    }
  }
  return messages;
}

function validateResult(
  rule: CalculationRule,
  inputs: CalculationInputs,
  result: number
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  if (!rule.validationRules) return messages;

  for (const vRule of rule.validationRules) {
    if (vRule.field !== "result") continue;
    if (vRule.type === "positive" && result <= 0) {
      messages.push({ level: "error", code: "NOT_POSITIVE", message: "Result must be positive" });
    }
    if (vRule.type === "non_negative" && result < 0) {
      messages.push({ level: "error", code: "NEGATIVE_RESULT", message: "Result cannot be negative" });
    }
    if (vRule.type === "less_than" && vRule.reference && vRule.reference in inputs) {
      if (result >= inputs[vRule.reference]) {
        messages.push({
          level: "warning",
          code: "EXCEEDS_REFERENCE",
          message: `Result should be less than ${vRule.reference}`,
        });
      }
    }
  }

  for (const vRule of rule.validationRules) {
    if (vRule.type === "non_zero" && vRule.field in inputs && inputs[vRule.field] === 0) {
      messages.push({
        level: "error",
        code: "ZERO_VALUE",
        message: `'${vRule.field}' must not be zero`,
        field: vRule.field,
      });
    }
  }

  return messages;
}

export function executeRule(
  rule: CalculationRule,
  rawInputs: CalculationInputs
): CalculationResult {
  const inputs = applyDefaults(rule, rawInputs);
  const inputValidation = validateInputs(rule, inputs);
  if (inputValidation.some((m) => m.level === "error")) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      result: NaN,
      unit: rule.outputUnit,
      steps: [],
      validation: inputValidation,
    };
  }

  const rawResult = evaluateExpression(rule.formula.expression, inputs);
  const result = round(rawResult, 2);
  const resultValidation = validateResult(rule, inputs, result);

  const step: CalculationStep = {
    ruleId: rule.id,
    ruleName: rule.name,
    formula: rule.formula.expression,
    latex: rule.formula.latex,
    inputs,
    result,
    unit: rule.outputUnit === "inherit" ? "unit" : rule.outputUnit,
  };

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    result,
    unit: rule.outputUnit === "inherit" ? "unit" : rule.outputUnit,
    steps: [step],
    validation: [...inputValidation, ...resultValidation],
  };
}

import { getRuleById } from "../formulas/registry.js";

export function executePipeline(
  steps: Array<{ ruleId: string; inputs: CalculationInputs }>
): CalculationResult[] {
  const results: CalculationResult[] = [];
  const context: CalculationInputs = {};

  for (const step of steps) {
    const rule = getRuleById(step.ruleId);
    if (!rule) throw new Error(`Rule not found: ${step.ruleId}`);
    const mergedInputs = { ...context, ...step.inputs };
    const result = executeRule(rule, mergedInputs);
    results.push(result);
    if (!Number.isNaN(result.result)) {
      context[`${step.ruleId}_result`] = result.result;
    }
  }
  return results;
}

export { evaluateExpression, round };
