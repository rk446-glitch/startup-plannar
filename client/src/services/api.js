import { apiUrl } from "./http.js";

async function postCalculation(path, values, isValidResult) {
  let response;

  try {
    response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(values),
    });
  } catch {
    throw new Error("Unable to reach the calculation service. Make sure the backend is running.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The calculation service returned an invalid response.");
  }

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(
      response.ok
        ? "The calculation service returned an invalid response."
        : "The calculation request could not be completed.",
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("foundry:session-expired"));
    }
    throw new Error(
      typeof payload.error === "string" && payload.error
        ? payload.error
        : "The calculation request could not be completed.",
    );
  }

  if (
    payload.success !== true ||
    payload.data === null ||
    typeof payload.data !== "object" ||
    Array.isArray(payload.data) ||
    !isValidResult(payload.data)
  ) {
    throw new Error("The calculation service returned an unexpected response.");
  }

  return payload.data;
}

export function calculateStartupCost(values) {
  return postCalculation(
    "/api/calculate/startup-cost",
    values,
    (data) => Number.isFinite(data.totalInitialInvestment),
  );
}

export function calculateMonthlyFinancials(values) {
  return postCalculation("/api/calculate/monthly-financials", values, (data) =>
    [
      data.sellingPricePerUnit,
      data.unitsSoldPerMonth,
      data.variableCostPerUnit,
      data.fixedMonthlyExpenses,
      data.monthlyRevenue,
      data.totalVariableExpenses,
      data.totalOperatingExpenses,
      data.monthlyOperatingProfitOrLoss,
    ].every(Number.isFinite) &&
    Number.isSafeInteger(data.unitsSoldPerMonth) &&
    (data.profitMarginPercentage === null || Number.isFinite(data.profitMarginPercentage)),
  );
}

export function calculateBreakEven(values) {
  return postCalculation("/api/calculate/break-even", values, (data) =>
    Number.isFinite(data.contributionPerUnit) &&
    typeof data.canBreakEven === "boolean" &&
    typeof data.message === "string" &&
    (data.canBreakEven
      ? Number.isSafeInteger(data.breakEvenUnits) && Number.isFinite(data.breakEvenRevenue)
      : data.breakEvenUnits === null && data.breakEvenRevenue === null),
  );
}

export async function calculateMonthlyCurve(baseValues) {
  const breakEven = await calculateBreakEven({
    sellingPricePerUnit: baseValues.sellingPricePerUnit,
    variableCostPerUnit: baseValues.variableCostPerUnit,
    fixedMonthlyExpenses: baseValues.fixedMonthlyExpenses,
  });

  const span = Math.max(1, baseValues.unitsSoldPerMonth, breakEven.canBreakEven ? breakEven.breakEvenUnits : 0);
  const quantities = [...new Set([0, 0.5, 1, 1.5, 2]
    .map((factor) => Math.round(span * factor))
    .filter((units) => Number.isSafeInteger(units)))];
  const points = await Promise.all(
    quantities.map((unitsSoldPerMonth) =>
      calculateMonthlyFinancials({ ...baseValues, unitsSoldPerMonth }),
    ),
  );

  return { breakEven, points };
}
