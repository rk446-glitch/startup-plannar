import { useEffect, useState } from "react";
import { calculateScenarioResults, scenarioNames } from "../services/analysis.js";
import { ComparisonChart } from "./FinancialCharts.jsx";

const defaultBase = {
  sellingPricePerUnit: 100,
  unitsSoldPerMonth: 1000,
  variableCostPerUnit: 40,
  fixedMonthlyExpenses: 30000,
};

const formatMoney = (value) =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function scenarioDefaults(base) {
  const scaledAmount = (value, factor) => {
    const scaled = value * factor;
    return Number.isFinite(scaled) ? Number(scaled.toPrecision(12)) : value;
  };
  const scaledUnits = (value, factor) => {
    const scaled = Math.round(value * factor);
    return Number.isSafeInteger(scaled) ? scaled : value;
  };

  return [
    {
      ...base,
      sellingPricePerUnit: scaledAmount(base.sellingPricePerUnit, 1.1),
      unitsSoldPerMonth: scaledUnits(base.unitsSoldPerMonth, 1.2),
      variableCostPerUnit: scaledAmount(base.variableCostPerUnit, 0.9),
      fixedMonthlyExpenses: scaledAmount(base.fixedMonthlyExpenses, 0.9),
    },
    { ...base },
    {
      ...base,
      sellingPricePerUnit: scaledAmount(base.sellingPricePerUnit, 0.9),
      unitsSoldPerMonth: scaledUnits(base.unitsSoldPerMonth, 0.8),
      variableCostPerUnit: scaledAmount(base.variableCostPerUnit, 1.1),
      fixedMonthlyExpenses: scaledAmount(base.fixedMonthlyExpenses, 1.1),
    },
  ];
}

function ScenarioField({ scenarioIndex, name, label, value, whole = false, onChange, disabled }) {
  const id = `scenario-${scenarioIndex}-${name}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min="0"
        step={whole ? "1" : "any"}
        inputMode={whole ? "numeric" : "decimal"}
        value={value ?? ""}
        onChange={(event) => onChange(scenarioIndex, name, event.target.value)}
        disabled={disabled}
        required
      />
    </div>
  );
}

function validateScenarios(scenarios) {
  const fields = [
    ["sellingPricePerUnit", "selling price", false],
    ["unitsSoldPerMonth", "units sold", true],
    ["variableCostPerUnit", "variable cost", false],
    ["fixedMonthlyExpenses", "fixed monthly expenses", false],
  ];
  for (let index = 0; index < scenarios.length; index += 1) {
    for (const [field, label, whole] of fields) {
      const value = Number(scenarios[index][field]);
      if (scenarios[index][field] === "" || !Number.isFinite(value) || value < 0) {
        return `${scenarioNames[index]}: enter a valid non-negative ${label} amount.`;
      }
      if (whole && !Number.isSafeInteger(value)) {
        return `${scenarioNames[index]}: units sold must be a non-negative whole number.`;
      }
    }
  }
  return "";
}

export default function ScenarioAnalysis({
  baseValues,
  initialScenarios,
  onInputsChange,
  onAnalysisComplete,
  onAnalysisChange,
}) {
  const initialBase = baseValues ?? defaultBase;
  const [scenarios, setScenarios] = useState(() =>
    (initialScenarios ?? scenarioDefaults(initialBase)).map((scenario) =>
      Object.fromEntries(
        ["sellingPricePerUnit", "unitsSoldPerMonth", "variableCostPerUnit", "fixedMonthlyExpenses"]
          .map((key) => [key, scenario[key] === undefined ? "" : String(scenario[key])]),
      ),
    ),
  );
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    onInputsChange?.(scenarios);
  }, []);

  function updateScenario(index, field, value) {
    setScenarios((current) =>
      current.map((scenario, currentIndex) =>
        currentIndex === index ? { ...scenario, [field]: value } : scenario,
      ),
    );
    setResults(null);
    setError("");
    onAnalysisChange?.(null);
    onInputsChange?.(scenarios.map((scenario, currentIndex) =>
      currentIndex === index ? { ...scenario, [field]: value } : scenario,
    ));
  }

  async function calculate(event) {
    event.preventDefault();
    if (loading) return;
    setResults(null);
    onAnalysisChange?.(null);
    const validationError = validateScenarios(scenarios);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const calculated = await calculateScenarioResults(scenarios);
      setResults(calculated);
      onAnalysisComplete?.(calculated);
    } catch (requestError) {
      setError(requestError.message || "Scenario calculations could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-content analysis-page">
      <p className="eyebrow">COMPARE YOUR ASSUMPTIONS</p>
      <h1>Scenario Analysis</h1>
      <p className="analysis-intro">
        Best, expected, and worst cases are user-defined illustrative assumptions, not predictions.
        Values are initially based on your latest successful monthly calculation when available.
      </p>
      <form onSubmit={calculate} noValidate>
        <div className="scenario-grid">
          {scenarios.map((scenario, index) => (
            <section className="scenario-card" key={scenarioNames[index]}>
              <div className="scenario-card-heading">
                <span className={`scenario-number scenario-${index}`}>0{index + 1}</span>
                <div>
                  <h2>{scenarioNames[index]}</h2>
                  <p>Illustrative and editable</p>
                </div>
              </div>
              <div className="analysis-fields">
                <ScenarioField scenarioIndex={index} name="sellingPricePerUnit" label="Selling price per unit" value={scenario.sellingPricePerUnit} onChange={updateScenario} disabled={loading} />
                <ScenarioField scenarioIndex={index} name="unitsSoldPerMonth" label="Expected units sold per month" value={scenario.unitsSoldPerMonth} whole onChange={updateScenario} disabled={loading} />
                <ScenarioField scenarioIndex={index} name="variableCostPerUnit" label="Variable cost per unit" value={scenario.variableCostPerUnit} onChange={updateScenario} disabled={loading} />
                <ScenarioField scenarioIndex={index} name="fixedMonthlyExpenses" label="Total fixed monthly expenses" value={scenario.fixedMonthlyExpenses} onChange={updateScenario} disabled={loading} />
              </div>
              {results && (
                <div className="scenario-result">
                  <ScenarioMetric label="Monthly revenue" value={formatMoney(results[index].result.monthlyRevenue)} />
                  <ScenarioMetric label="Operating expenses" value={formatMoney(results[index].result.totalOperatingExpenses)} />
                  <ScenarioMetric
                    label={results[index].result.monthlyOperatingProfitOrLoss < 0 ? "Operating loss" : "Operating profit"}
                    value={formatMoney(Math.abs(results[index].result.monthlyOperatingProfitOrLoss))}
                    negative={results[index].result.monthlyOperatingProfitOrLoss < 0}
                  />
                  <ScenarioMetric
                    label="Profit margin"
                    value={results[index].result.profitMarginPercentage === null ? "— (no revenue)" : `${results[index].result.profitMarginPercentage.toFixed(2)}%`}
                  />
                  <ScenarioMetric
                    label="Break-even"
                    value={results[index].breakEven.canBreakEven ? `${results[index].breakEven.breakEvenUnits} units` : "Not achievable"}
                  />
                  {!results[index].breakEven.canBreakEven && (
                    <p className="scenario-warning">{results[index].breakEven.message}</p>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="analysis-actions">
          <button className="calculate-button" type="submit" disabled={loading}>
            {loading ? "Calculating scenarios…" : "Calculate all scenarios"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
          <span>Six backend calculations are requested when you submit.</span>
        </div>
      </form>
      {results ? (
        <>
          <p className="currency-note">All amounts are illustrative currency units. Scenario results are deterministic calculations, not predictions.</p>
          <ComparisonChart rows={results} />
        </>
      ) : (
        <div className="analysis-empty">
          <h2>Scenario comparison will appear here</h2>
          <p>Edit assumptions and calculate to compare backend results.</p>
        </div>
      )}
    </div>
  );
}

function ScenarioMetric({ label, value, negative = false }) {
  return (
    <div className="scenario-metric">
      <span>{label}</span>
      <strong className={negative ? "negative-value" : ""}>{value}</strong>
    </div>
  );
}
