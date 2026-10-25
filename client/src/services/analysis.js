import {
  calculateBreakEven,
  calculateMonthlyFinancials,
} from "./api.js";

export const scenarioNames = ["Best case", "Expected case", "Worst case"];
export const sensitivityChanges = [-20, -10, 0, 10, 20];

export async function calculateScenarioResults(scenarios) {
  return Promise.all(
    scenarios.map(async (scenario, index) => {
      const values = {
        sellingPricePerUnit: Number(scenario.sellingPricePerUnit),
        unitsSoldPerMonth: Number(scenario.unitsSoldPerMonth),
        variableCostPerUnit: Number(scenario.variableCostPerUnit),
        fixedMonthlyExpenses: Number(scenario.fixedMonthlyExpenses),
      };
      const [result, breakEven] = await Promise.all([
        calculateMonthlyFinancials(values),
        calculateBreakEven({
          sellingPricePerUnit: values.sellingPricePerUnit,
          variableCostPerUnit: values.variableCostPerUnit,
          fixedMonthlyExpenses: values.fixedMonthlyExpenses,
        }),
      ]);
      return { label: scenarioNames[index], result, breakEven };
    }),
  );
}

export async function calculateSensitivityResults(base, variable) {
  const generatedValues = sensitivityChanges.map((percent) => {
    const changedValue = base[variable] * (1 + percent / 100);
    return variable === "unitsSoldPerMonth" ? Math.round(changedValue) : changedValue;
  });

  if (
    generatedValues.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0 ||
        (variable === "unitsSoldPerMonth" && !Number.isSafeInteger(value)),
    )
  ) {
    throw new Error("The selected percentage changes exceed the supported range. Use smaller baseline values.");
  }

  return Promise.all(
    sensitivityChanges.map(async (percent, index) => {
      const variedValue = generatedValues[index];
      const values = { ...base, [variable]: variedValue };
      const [result, breakEven] = await Promise.all([
        calculateMonthlyFinancials(values),
        calculateBreakEven({
          sellingPricePerUnit: values.sellingPricePerUnit,
          variableCostPerUnit: values.variableCostPerUnit,
          fixedMonthlyExpenses: values.fixedMonthlyExpenses,
        }),
      ]);
      return {
        percent,
        changeLabel: percent === 0 ? "Baseline" : `${percent > 0 ? "+" : ""}${percent}%`,
        variedValue,
        result,
        breakEven,
      };
    }),
  );
}
