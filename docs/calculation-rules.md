# Calculation Rules — Machine-Readable Registry

**Methodology version:** 1.0.0  
**Source:** Chapter 3, *Estimating and Costing*

This file defines every calculation rule in structured JSON-compatible form. The calculation engine loads these rules deterministically — no LLM involvement in numeric evaluation.

---

## Rule Schema

```typescript
interface CalculationRule {
  id: string;
  name: string;
  description: string;
  category: "geometry" | "quantity" | "cost";
  method: "long_short_wall" | "centre_line" | "direct" | "deduction" | "costing";
  requiredVariables: VariableDefinition[];
  optionalVariables?: VariableDefinition[];
  formula: FormulaDefinition;
  outputUnit: string;
  validationRules: ValidationRule[];
}
```

---

## Geometry Rules

### RULE-GEO-001: Centre-to-Centre Long Wall Length

```json
{
  "id": "RULE-GEO-001",
  "name": "Centre-to-Centre Long Wall Length",
  "category": "geometry",
  "method": "long_short_wall",
  "requiredVariables": [
    { "id": "external_length", "unit": "m", "min": 0 },
    { "id": "wall_thickness", "unit": "m", "min": 0 }
  ],
  "formula": {
    "expression": "external_length - wall_thickness",
    "latex": "L_{c-c,long} = L_{ext} - t"
  },
  "outputUnit": "m",
  "validationRules": [
    { "type": "positive", "field": "result" },
    { "type": "less_than", "field": "result", "reference": "external_length" }
  ]
}
```

### RULE-GEO-002: Centre-to-Centre Short Wall Length

```json
{
  "id": "RULE-GEO-002",
  "name": "Centre-to-Centre Short Wall Length",
  "category": "geometry",
  "method": "long_short_wall",
  "requiredVariables": [
    { "id": "external_width", "unit": "m", "min": 0 },
    { "id": "wall_thickness", "unit": "m", "min": 0 }
  ],
  "formula": {
    "expression": "external_width - wall_thickness",
    "latex": "L_{c-c,short} = W_{ext} - t"
  },
  "outputUnit": "m"
}
```

### RULE-GEO-003: Long Wall Item Length

```json
{
  "id": "RULE-GEO-003",
  "name": "Long Wall Measurement Length",
  "category": "geometry",
  "method": "long_short_wall",
  "requiredVariables": [
    { "id": "c_to_c_long", "unit": "m" },
    { "id": "offset", "unit": "m", "description": "Breadth or wall thickness offset" }
  ],
  "formula": {
    "expression": "c_to_c_long + offset",
    "latex": "L_{long} = L_{c-c,long} + offset"
  },
  "outputUnit": "m"
}
```

### RULE-GEO-004: Short Wall Item Length

```json
{
  "id": "RULE-GEO-004",
  "name": "Short Wall Measurement Length",
  "category": "geometry",
  "method": "long_short_wall",
  "requiredVariables": [
    { "id": "c_to_c_short", "unit": "m" },
    { "id": "offset", "unit": "m" }
  ],
  "formula": {
    "expression": "c_to_c_short - offset",
    "latex": "L_{short} = L_{c-c,short} - offset"
  },
  "outputUnit": "m"
}
```

### RULE-GEO-005: Total Centre Line Length (Rectangular, Uniform)

```json
{
  "id": "RULE-GEO-005",
  "name": "Total Centre Line Length",
  "category": "geometry",
  "method": "centre_line",
  "requiredVariables": [
    { "id": "c_to_c_long", "unit": "m" },
    { "id": "c_to_c_short", "unit": "m" },
    { "id": "long_wall_count", "unit": "count", "default": 2 },
    { "id": "short_wall_count", "unit": "count", "default": 2 }
  ],
  "formula": {
    "expression": "long_wall_count * c_to_c_long + short_wall_count * c_to_c_short",
    "latex": "CL_{total} = n_L \\cdot L_{c-c,long} + n_S \\cdot L_{c-c,short}"
  },
  "outputUnit": "m"
}
```

### RULE-GEO-006: Adjusted Centre Line (Junction Correction)

```json
{
  "id": "RULE-GEO-006",
  "name": "Centre Line with Junction Correction",
  "category": "geometry",
  "method": "centre_line",
  "requiredVariables": [
    { "id": "gross_cl", "unit": "m" },
    { "id": "junction_count", "unit": "count" },
    { "id": "junction_correction", "unit": "m", "description": "Per junction deduction (e.g. t/2)" }
  ],
  "formula": {
    "expression": "gross_cl - junction_count * junction_correction",
    "latex": "CL_{adj} = CL_{gross} - n_j \\cdot c_j"
  },
  "outputUnit": "m",
  "notes": "UNRESOLVED U-001: junction_correction varies by example"
}
```

---

## Quantity Rules — Volume (cum)

### RULE-QTY-001: Volume — General

```json
{
  "id": "RULE-QTY-001",
  "name": "Volume Quantity",
  "category": "quantity",
  "method": "direct",
  "requiredVariables": [
    { "id": "number", "unit": "count", "default": 1 },
    { "id": "length", "unit": "m" },
    { "id": "breadth", "unit": "m" },
    { "id": "height_or_depth", "unit": "m" }
  ],
  "formula": {
    "expression": "number * length * breadth * height_or_depth",
    "latex": "Q = N \\times L \\times B \\times H"
  },
  "outputUnit": "cum",
  "workItems": [
    "earthwork_excavation",
    "earthwork_filling",
    "lime_concrete",
    "brickwork",
    "rcc"
  ]
}
```

### RULE-QTY-002: Long/Short Wall Volume Sum

```json
{
  "id": "RULE-QTY-002",
  "name": "Long/Short Wall Combined Volume",
  "category": "quantity",
  "method": "long_short_wall",
  "requiredVariables": [
    { "id": "long_wall_count", "unit": "count" },
    { "id": "long_wall_length", "unit": "m" },
    { "id": "short_wall_count", "unit": "count" },
    { "id": "short_wall_length", "unit": "m" },
    { "id": "breadth", "unit": "m" },
    { "id": "height_or_depth", "unit": "m" }
  ],
  "formula": {
    "expression": "long_wall_count * long_wall_length * breadth * height_or_depth + short_wall_count * short_wall_length * breadth * height_or_depth",
    "latex": "Q = n_L L_L B H + n_S L_S B H"
  },
  "outputUnit": "cum"
}
```

### RULE-QTY-003: Centre Line Volume

```json
{
  "id": "RULE-QTY-003",
  "name": "Centre Line Volume",
  "category": "quantity",
  "method": "centre_line",
  "requiredVariables": [
    { "id": "total_cl", "unit": "m" },
    { "id": "breadth", "unit": "m" },
    { "id": "height_or_depth", "unit": "m" }
  ],
  "formula": {
    "expression": "total_cl * breadth * height_or_depth",
    "latex": "Q = CL_{total} \\times B \\times H"
  },
  "outputUnit": "cum"
}
```

---

## Quantity Rules — Area (sqm)

### RULE-QTY-010: Area — Length × Breadth

```json
{
  "id": "RULE-QTY-010",
  "name": "Area (L × B)",
  "category": "quantity",
  "method": "direct",
  "requiredVariables": [
    { "id": "number", "unit": "count", "default": 1 },
    { "id": "length", "unit": "m" },
    { "id": "breadth", "unit": "m" }
  ],
  "formula": {
    "expression": "number * length * breadth",
    "latex": "Q = N \\times L \\times B"
  },
  "outputUnit": "sqm",
  "workItems": ["cement_concrete_floor", "dpc", "terracing"]
}
```

### RULE-QTY-011: Area — Length × Height (Plastering)

```json
{
  "id": "RULE-QTY-011",
  "name": "Area (L × H) — Plastering",
  "category": "quantity",
  "method": "direct",
  "requiredVariables": [
    { "id": "number", "unit": "count", "default": 1 },
    { "id": "length", "unit": "m" },
    { "id": "height", "unit": "m" }
  ],
  "formula": {
    "expression": "number * length * height",
    "latex": "Q = N \\times L \\times H"
  },
  "outputUnit": "sqm",
  "workItems": ["cement_plaster", "whitewashing", "painting"]
}
```

### RULE-QTY-012: Net Quantity with Deductions

```json
{
  "id": "RULE-QTY-012",
  "name": "Net Quantity After Deductions",
  "category": "quantity",
  "method": "deduction",
  "requiredVariables": [
    { "id": "gross_quantity", "unit": "any" },
    { "id": "total_deductions", "unit": "any", "default": 0 }
  ],
  "formula": {
    "expression": "gross_quantity - total_deductions",
    "latex": "Q_{net} = Q_{gross} - \\sum D"
  },
  "outputUnit": "inherit",
  "validationRules": [
    { "type": "non_negative", "field": "result" }
  ]
}
```

---

## Costing Rules

### RULE-COST-001: Item Amount

```json
{
  "id": "RULE-COST-001",
  "name": "Item Cost Amount",
  "category": "cost",
  "method": "costing",
  "requiredVariables": [
    { "id": "quantity", "unit": "any" },
    { "id": "rate", "unit": "Rs." }
  ],
  "formula": {
    "expression": "quantity * rate",
    "latex": "Amount = Q \\times R"
  },
  "outputUnit": "Rs."
}
```

### RULE-COST-002: Contingencies

```json
{
  "id": "RULE-COST-002",
  "name": "Contingencies (3%)",
  "category": "cost",
  "method": "costing",
  "requiredVariables": [
    { "id": "subtotal", "unit": "Rs." },
    { "id": "contingency_rate", "unit": "ratio", "default": 0.03 }
  ],
  "formula": {
    "expression": "subtotal * contingency_rate",
    "latex": "Contingencies = 0.03 \\times Subtotal"
  },
  "outputUnit": "Rs."
}
```

### RULE-COST-003: Work-Charged Establishment

```json
{
  "id": "RULE-COST-003",
  "name": "Work-Charged Establishment (2%)",
  "category": "cost",
  "method": "costing",
  "requiredVariables": [
    { "id": "subtotal", "unit": "Rs." },
    { "id": "wce_rate", "unit": "ratio", "default": 0.02 }
  ],
  "formula": {
    "expression": "subtotal * wce_rate",
    "latex": "WCE = 0.02 \\times Subtotal"
  },
  "outputUnit": "Rs."
}
```

### RULE-COST-004: Grand Total

```json
{
  "id": "RULE-COST-004",
  "name": "Grand Total",
  "category": "cost",
  "method": "costing",
  "requiredVariables": [
    { "id": "subtotal", "unit": "Rs." },
    { "id": "contingencies", "unit": "Rs." },
    { "id": "wce", "unit": "Rs." }
  ],
  "formula": {
    "expression": "subtotal + contingencies + wce",
    "latex": "Grand\\ Total = Subtotal + Contingencies + WCE"
  },
  "outputUnit": "Rs."
}
```

### RULE-COST-005: Plinth Area Rate

```json
{
  "id": "RULE-COST-005",
  "name": "Plinth Area Rate",
  "category": "cost",
  "method": "costing",
  "requiredVariables": [
    { "id": "grand_total", "unit": "Rs." },
    { "id": "plinth_length", "unit": "m" },
    { "id": "plinth_width", "unit": "m" }
  ],
  "formula": {
    "expression": "grand_total / (plinth_length * plinth_width)",
    "latex": "PA\\ Rate = Grand\\ Total / (L_{plinth} \\times W_{plinth})"
  },
  "outputUnit": "Rs./sqm",
  "validationRules": [
    { "type": "non_zero", "field": "plinth_length" },
    { "type": "non_zero", "field": "plinth_width" }
  ]
}
```

---

## Verification Examples (from Chapter 3)

### VERIFY-EX-001: Masonry Platform — Earthwork Excavation (Centre Line)

| Input | Value |
|-------|-------|
| c_to_c_long | 5.60 m |
| c_to_c_short | 4.60 m |
| breadth | 0.80 m |
| depth | 0.70 m |

| Step | Rule | Expected |
|------|------|----------|
| total_cl | RULE-GEO-005 | 20.40 m |
| quantity | RULE-QTY-003 | 11.42 cum |

### VERIFY-EX-002: Masonry Platform — Long/Short Wall Excavation

| Input | Value |
|-------|-------|
| c_to_c_long | 5.60 m |
| c_to_c_short | 4.60 m |
| offset (B) | 0.80 m |
| depth | 0.70 m |

| Step | Rule | Expected |
|------|------|----------|
| long_wall_length | RULE-GEO-003 | 6.40 m |
| short_wall_length | RULE-GEO-004 | 3.80 m |
| quantity | RULE-QTY-002 | 11.42 cum |

### VERIFY-EX-003: Motor Garage — Plinth Area Rate

| Input | Value |
|-------|-------|
| plinth_length | 7.10 m |
| plinth_width | 3.60 m |
| grand_total | 15306.57 Rs. |

| Step | Rule | Expected |
|------|------|----------|
| plinth_area | direct | 25.56 sqm |
| plinth_area_rate | RULE-COST-005 | 598.85 Rs./sqm |
