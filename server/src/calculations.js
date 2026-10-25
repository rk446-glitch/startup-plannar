class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function validateObject(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Request body must be a JSON object.");
  }
}

function requiredAmount(input, fieldName) {
  if (!Object.prototype.hasOwnProperty.call(input, fieldName)) {
    throw new ValidationError(`"${fieldName}" is required.`);
  }

  const value = input[fieldName];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(`"${fieldName}" must be a finite, non-negative number.`);
  }

  return value;
}

function requiredUnits(input, fieldName = "unitsSoldPerMonth") {
  const value = requiredAmount(input, fieldName);
  if (!Number.isSafeInteger(value)) {
    throw new ValidationError(`"${fieldName}" must be a non-negative safe whole number.`);
  }
  return value;
}

function requireFiniteResult(value, description) {
  if (!Number.isFinite(value)) {
    throw new ValidationError(
      `The ${description} exceeds the supported numeric range for a reliable calculation.`,
    );
  }
  return value;
}

function requireSafeUnitResult(value) {
  if (!Number.isSafeInteger(value)) {
    throw new ValidationError(
      "The break-even unit count exceeds the supported numeric range for a reliable calculation.",
    );
  }
  return value;
}

function calculateStartupInvestment(expenses) {
  validateObject(expenses);

  const fields = [
    "equipment",
    "furniture",
    "renovation",
    "registrationAndLicenses",
    "initialInventory",
    "shopDeposit",
    "otherStartupCosts",
  ];
  const itemizedCosts = {};

  for (const field of fields) {
    itemizedCosts[field] = requiredAmount(expenses, field);
  }

  const totalInitialInvestment = requireFiniteResult(
    Object.values(itemizedCosts).reduce((total, amount) => total + amount, 0),
    "total initial investment",
  );

  return { itemizedCosts, totalInitialInvestment };
}

function calculateMonthlyOperatingExpenses(expenses) {
  validateObject(expenses);

  const fixedExpenseFields = [
    "monthlyRent",
    "salaries",
    "utilities",
    "marketing",
    "otherFixedMonthlyExpenses",
  ];
  const fixedExpenseBreakdown = {};

  for (const field of fixedExpenseFields) {
    fixedExpenseBreakdown[field] = requiredAmount(expenses, field);
  }

  const variableCostPerUnit = requiredAmount(expenses, "variableCostPerUnit");
  const unitsSoldPerMonth = requiredUnits(expenses);
  const totalFixedMonthlyExpenses = requireFiniteResult(
    Object.values(fixedExpenseBreakdown).reduce((total, amount) => total + amount, 0),
    "total fixed monthly expenses",
  );
  const totalVariableExpenses = requireFiniteResult(
    variableCostPerUnit * unitsSoldPerMonth,
    "total variable expenses",
  );
  const totalMonthlyOperatingExpenses = requireFiniteResult(
    totalFixedMonthlyExpenses + totalVariableExpenses,
    "total monthly operating expenses",
  );

  return {
    fixedExpenseBreakdown,
    totalFixedMonthlyExpenses,
    variableCostPerUnit,
    unitsSoldPerMonth,
    totalVariableExpenses,
    totalMonthlyOperatingExpenses,
  };
}

function calculateMonthlyFinancials(financials) {
  validateObject(financials);

  const sellingPricePerUnit = requiredAmount(financials, "sellingPricePerUnit");
  const unitsSoldPerMonth = requiredUnits(financials);
  let variableCostPerUnit;
  let fixedMonthlyExpenses;

  if (Object.prototype.hasOwnProperty.call(financials, "fixedMonthlyExpenses")) {
    variableCostPerUnit = requiredAmount(financials, "variableCostPerUnit");
    fixedMonthlyExpenses = requiredAmount(financials, "fixedMonthlyExpenses");
  } else {
    const monthlyExpenses = calculateMonthlyOperatingExpenses({
      monthlyRent: financials.monthlyRent,
      salaries: financials.salaries,
      utilities: financials.utilities,
      marketing: financials.marketing,
      otherFixedMonthlyExpenses: financials.otherFixedMonthlyExpenses,
      variableCostPerUnit: financials.variableCostPerUnit,
      unitsSoldPerMonth,
    });
    variableCostPerUnit = monthlyExpenses.variableCostPerUnit;
    fixedMonthlyExpenses = monthlyExpenses.totalFixedMonthlyExpenses;
  }

  const monthlyRevenue = requireFiniteResult(
    sellingPricePerUnit * unitsSoldPerMonth,
    "monthly revenue",
  );
  const totalVariableExpenses = requireFiniteResult(
    variableCostPerUnit * unitsSoldPerMonth,
    "total variable expenses",
  );
  const totalOperatingExpenses = requireFiniteResult(
    fixedMonthlyExpenses + totalVariableExpenses,
    "total operating expenses",
  );
  const monthlyOperatingProfitOrLoss = monthlyRevenue - totalOperatingExpenses;
  const profitMarginPercentage =
    monthlyRevenue > 0 ? (monthlyOperatingProfitOrLoss / monthlyRevenue) * 100 : null;

  return {
    sellingPricePerUnit,
    unitsSoldPerMonth,
    variableCostPerUnit,
    fixedMonthlyExpenses,
    monthlyRevenue,
    totalVariableExpenses,
    totalOperatingExpenses,
    monthlyOperatingProfitOrLoss,
    profitMarginPercentage:
      profitMarginPercentage === null
        ? null
        : requireFiniteResult(profitMarginPercentage, "profit margin"),
  };
}

function calculateBreakEven(financials) {
  validateObject(financials);

  const sellingPricePerUnit = requiredAmount(financials, "sellingPricePerUnit");
  const variableCostPerUnit = requiredAmount(financials, "variableCostPerUnit");
  const fixedMonthlyExpenses = requiredAmount(financials, "fixedMonthlyExpenses");
  const contributionPerUnit = sellingPricePerUnit - variableCostPerUnit;

  if (contributionPerUnit <= 0) {
    return {
      sellingPricePerUnit,
      variableCostPerUnit,
      fixedMonthlyExpenses,
      contributionPerUnit,
      canBreakEven: false,
      breakEvenUnits: null,
      breakEvenRevenue: null,
      message:
        "Break-even cannot be achieved through additional unit sales at the current price and variable cost.",
    };
  }

  const breakEvenUnits = requireSafeUnitResult(
    fixedMonthlyExpenses === 0
      ? 0
      : Math.ceil(fixedMonthlyExpenses / contributionPerUnit),
  );
  const breakEvenRevenue = requireFiniteResult(
    breakEvenUnits * sellingPricePerUnit,
    "break-even revenue",
  );

  return {
    sellingPricePerUnit,
    variableCostPerUnit,
    fixedMonthlyExpenses,
    contributionPerUnit,
    canBreakEven: true,
    breakEvenUnits,
    breakEvenRevenue,
    message: "Break-even point calculated successfully.",
  };
}

module.exports = {
  ValidationError,
  calculateStartupInvestment,
  calculateMonthlyOperatingExpenses,
  calculateMonthlyFinancials,
  calculateBreakEven,
};
