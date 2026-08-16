# Chapter 3 Methodology — Estimate of Buildings

**Source:** *Estimating and Costing*, Chapter 3 — Estimate of Buildings  
**Document:** `chap 3.pdf` (117 pages, scanned)  
**Methodology version:** 1.0.0  
**Extraction method:** OCR (Tesseract) from scanned PDF

---

## 1. Overview

Chapter 3 covers **detailed quantity estimation and costing of buildings**. The chapter teaches two primary wall-measurement methods and applies them across multiple worked examples (masonry platform, water tank, motor garage, single-room building with verandah, and others).

The system must **not invent formulas**. All calculations derive from the procedures documented below.

---

## 2. Measurement Methods

### 2.1 General Method — Long Wall and Short Wall Method

Used when walls are of **different types** or **junctions exist** between walls of different thickness.

#### Centre-to-Centre Lengths

For a rectangular building with external dimensions and uniform wall thickness `t`:

| Variable | Formula | Notes |
|----------|---------|-------|
| `c_to_c_long` | `external_length - t` | Example 1: 6.00 − 2×0.20 = 5.60 m (OCR: "2 x .20") |
| `c_to_c_short` | `external_width - t` | Example 1: 5.00 − 2×0.20 = 4.60 m |

> **Assumption (from Ex. 1):** `t` represents the full wall thickness; each side contributes `t/2`, hence subtract `2 × (t/2) = t` from external dimension.  
> **Unresolved:** When footings are asymmetrical above G.L., c-to-c lengths differ per level (see Ex. 2, Masonry Tank).

#### Long Wall and Short Wall Lengths

For each item of work, lengths are adjusted from centre-to-centre lengths:

| Wall type | Length formula | Example (Ex. 1, excavation B=0.80) |
|-----------|----------------|-------------------------------------|
| Long wall | `c_to_c_long + B` | L = 5.60 + 0.80 = 6.40 m |
| Short wall | `c_to_c_short - B` | D = 4.60 − 0.80 = 3.80 m |

For brickwork with wall thickness equal to footing width:

| Wall type | Length formula | Example |
|-----------|----------------|---------|
| Long wall | `c_to_c_long + wall_thickness` | L = 5.60 + 0.60 = 6.20 m (1st footing) |
| Short wall | `c_to_c_short - wall_thickness` | L = 4.60 − 0.60 = 4.00 m (1st footing) |

**Terminology preserved from document:** *Long walls*, *Short walls*, *Centre to centre length*.

---

### 2.2 Centre Line Method

Used when walls are of the **same type** and **no junctions** (or junction corrections are applied).

#### Total Centre Line Length

```
total_cl = Σ (count × c_to_c_length) for all wall segments
```

Example 1 (Masonry Platform):
```
Long walls:  2 × 5.60 = 11.20 m
Short walls: 2 × 4.60 =  9.20 m
Total CL:    20.40 m
```

#### Quantity (uniform walls, no junctions)

```
quantity = 1 × total_cl × breadth × height_or_depth
```

Example 1 — Earthwork excavation: `1 × 20.40 × 0.80 × 0.70 = 11.42 cum`

#### Junction Corrections (Ex. 3, Motor Garage Ramp)

When walls join thicker main walls, centre line length is reduced:

```
adjusted_cl = gross_cl - (number_of_junctions × junction_correction)
```

Example (Ramp): `L = 7.10 − 2 × (t/2) = 6.50 m` where two junctions exist with main walls.

> **Unresolved:** General junction correction table — document gives per-example corrections only. Configurable via `junctionCorrection` parameter.

---

## 3. Quantity Formulas by Work Item

### 3.1 Volume Items (unit: cum — cubic metre)

| Item | Formula | Variables |
|------|---------|-----------|
| Earthwork in excavation | `No × L × B × D` | L=length, B=breadth, D=depth |
| Earthwork in filling | `No × L × B × H` | H=height of fill |
| Lime concrete | `No × L × B × D` | |
| Brickwork | `No × L × B × H` | H may vary per footing/course |
| R.C.C. work | `No × L × B × D` | Excludes steel (measured separately) |

### 3.2 Area Items (unit: sqm — square metre)

| Item | Formula | Variables |
|------|---------|-----------|
| Cement/sand plastering | `No × L × H` | Walls: L × H; may include below G.L. |
| Cement concrete flooring | `No × L × B` | May include underlying lime concrete |
| D.P.C. (Damp Proof Course) | `No × L × B` | |
| Whitewashing / Painting | `No × L × H` or gross area minus deductions | |
| Terracing | `No × L × B` | |

### 3.3 Deductions

Openings, sills, gates, and portions below ground level are **deducted** from gross quantities:

```
net_quantity = gross_quantity - Σ(deduction_quantities)
```

Examples from document:
- Deduct gate sill: `1 × 2.50 × 0.40 = 1.00 sqm` (DPC, Ex. 3)
- Deduct door openings from brickwork superstructure
- Deduct portion below G.L. from whitewashing

---

## 4. Costing Procedure (Abstract of Estimated Cost)

For each item:

```
amount = quantity × rate_per_unit
```

Subtotal:
```
subtotal = Σ(item_amounts)
```

Additions (from examples):
```
contingencies = subtotal × 0.03    (3%)
wce = subtotal × 0.02              (2% Work-charged Establishment)
grand_total = subtotal + contingencies + wce
```

Plinth area rate:
```
plinth_area = length × width   (of plinth/covered area)
plinth_area_rate = grand_total / plinth_area   (Rs. per sq m)
```

---

## 5. Worked Examples in Chapter 3

| Example | Description | Primary Method |
|---------|-------------|----------------|
| Ex. 1 | Masonry platform 6 m × 5 m | Long/short wall + centre line |
| Ex. 2 | Masonry water tank | Long/short wall (asymmetric above G.L.) |
| Ex. 3 | Motor garage with ramp | Long/short wall + centre line |
| Ex. 4 | Single room with front verandah | Long/short wall |
| Ex. 5+ | Additional building types | Long/short wall / centre line |

---

## 6. Variables Glossary

| Variable | Description | Unit |
|----------|-------------|------|
| `external_length` | External/long side dimension | m |
| `external_width` | External/short side dimension | m |
| `wall_thickness` | Thickness of wall (`t`) | m |
| `c_to_c_long` | Centre-to-centre length of long walls | m |
| `c_to_c_short` | Centre-to-centre length of short walls | m |
| `long_wall_length` | Adjusted length for long wall items | m |
| `short_wall_length` | Adjusted length for short wall items | m |
| `total_cl` | Total centre line length | m |
| `L`, `B`, `H`, `D` | Length, breadth, height, depth | m |
| `No` | Number of units (walls, items) | count |
| `quantity` | Measured work quantity | cum / sqm / etc. |
| `rate` | Unit rate | Rs. per unit |
| `plinth_area` | Covered plinth floor area | sqm |

---

## 7. Units

| Unit | Meaning |
|------|---------|
| m | metre |
| cum / cu m | cubic metre |
| sqm / sq m | square metre |
| Rs. | Indian Rupees |
| kg | kilogram (steel, hold-fasts) |
| quin / quintal | hundredweight (steel bars) |

**Internal normalization:** All lengths → metres; volumes → cum; areas → sqm.

---

## 8. Assumptions and Special Cases

1. **Symmetrical footings below G.L.:** c-to-c lengths are constant for all footings at a given level.
2. **Asymmetrical above G.L. (Ex. 2):** c-to-c lengths change with each wall thickness step.
3. **Verandah/pillars (Ex. 4):** Additional wall segments measured separately with their own c-to-c lengths.
4. **Small deductions:** Document notes projections "may be neglected being small" — configurable threshold.
5. **Rates:** Taken from "local current rates" — user-configurable, not computed by system.

---

## 9. Unresolved Items (Configurable Later)

| ID | Description |
|----|-------------|
| U-001 | General junction correction formula for all wall thickness combinations |
| U-002 | Automatic method selection (long/short vs centre line) from diagram alone |
| U-003 | Multi-storey c-to-c length transitions |
| U-004 | Steel quantity from R.C.C. (measured separately in examples) |
| U-005 | Complete list of all examples Ex. 5–N (OCR of remaining pages pending) |

---

## 10. Image-to-Variable Mapping Hints

When processing uploaded drawings, map detected dimensions to:

| Drawing label / position | Likely variable |
|--------------------------|-----------------|
| Overall length annotation | `external_length` |
| Overall width annotation | `external_width` |
| Wall thickness notation | `wall_thickness` |
| Foundation depth | `D` (excavation) |
| Plinth height | `H` (filling, brickwork) |
| Room internal dimensions | Used to derive c-to-c lengths |
| "L=", "B=", "H=" labels | Direct variable assignment |
| Dimension on long side | Long wall measurement |
| Dimension on short side | Short wall measurement |
