import { Router } from "express";
import { CALCULATION_RULES } from "@auto-measure/calculation-engine";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    methodologyVersion: "1.0.0",
    rules: CALCULATION_RULES,
  });
});

export { router as calculationRulesRouter };
