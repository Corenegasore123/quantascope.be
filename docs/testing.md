# Testing Strategy

## Calculation Engine Tests

Location: `packages/calculation-engine/src/tests/`

### Verification Examples from Chapter 3

| Test ID | Description | Expected |
|---------|-------------|----------|
| VERIFY-EX-001 | Centre line excavation (Ex. 1) | 11.42 cum |
| VERIFY-EX-002 | Long/short wall excavation (Ex. 1) | 11.42 cum |
| VERIFY-EX-003 | Plinth area rate (Ex. 3) | 598.85 Rs./sqm |

Run:
```bash
npm run test:engine
```

## Unit Test Coverage

- Unit conversion (cm→m, mm→m, ft→m)
- Centre-to-centre geometry (Ex. 1: 5.60 m, 4.60 m)
- Costing rules (3% contingencies, 2% WCE)
- Formula validation (missing variables, negative results)

## Integration Tests

Manual integration test flow:

1. Start CV service + web app
2. Upload test diagram with labeled dimensions
3. Verify measurements extracted
4. Verify calculation matches expected quantity
5. Export JSON report and verify audit trail

## Edge Cases to Test

- Rotated/low-quality images
- Missing units (defaults to metres with warning)
- Multiple measurements (size-sorted variable assignment)
- Insufficient measurements (graceful failure)
- PDF upload (first page extraction)

## CI Pipeline (Recommended)

```yaml
- npm run typecheck
- npm run test:engine
- npm run lint
- pytest services/cv-service/tests/
```
