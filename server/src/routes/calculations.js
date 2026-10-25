const express = require("express");
const {
  ValidationError,
  calculateStartupInvestment,
  calculateMonthlyFinancials,
  calculateBreakEven,
} = require("../calculations");
const router = express.Router();

function handleCalculation(calculation) {
  return (req, res, next) => {
    try {
      const result = calculation(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  };
}

router.post("/startup-cost", handleCalculation(calculateStartupInvestment));
router.post("/monthly-financials", handleCalculation(calculateMonthlyFinancials));
router.post("/break-even", handleCalculation(calculateBreakEven));

module.exports = router;
