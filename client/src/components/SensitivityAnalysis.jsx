import { useEffect, useState } from "react";
import { calculateSensitivityResults } from "../services/analysis.js";
import { SensitivityChart } from "./FinancialCharts.jsx";

const defaultBase = {
  sellingPricePerUnit: 100,
  unitsSoldPerMonth: 1000,
  variableCostPerUnit: 40,
  fixedMonthlyExpenses: 30000,
};

const assumptions = [
  ["sellingPricePerUnit", "Selling price per unit"],
  ["unitsSoldPerMonth", "Monthly units sold"],
  ["variableCostPerUnit", "Variable cost per unit"],
  ["fixedMonthlyExpenses", "Fixed monthly expenses"],
];
const formatMoney = (value) =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function validateBase(values) {
  for (const [name, label] of assumptions) {
    const value = Number(values[name]);
    if (values[name] === "" || !Number.isFinite(value) || value < 0) {
      return `${label} must be a finite, non-negative number.`;
    }
    if (name === "unitsSoldPerMonth" && !Number.isSafeInteger(value)) {
      return "Monthly units sold must be a non-negative whole number.";
    }
  }
  return "";
}

export default function SensitivityAnalysis({
  baseValues,
  initialBaseline,
  initialVariable,
  onInputsChange,
  onAnalysisComplete,
  onAnalysisChange,
}) {
  const [baseline, setBaseline] = useState(() => {
    const values = initialBaseline ?? baseValues ?? defaultBase;
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
  });
  const [variable, setVariable] = useState(initialVariable ?? "sellingPricePerUnit");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedLabel = assumptions.find(([name]) => name === variable)[1];
  useEffect(() => {
    onInputsChange?.(baseline, variable);
  }, []);

  function updateBaseline(event) {
    const { name, value } = event.target;
    setBaseline((current) => ({ ...current, [name]: value }));
    setResults(null);
    setError("");
    onAnalysisChange?.(null);
    onInputsChange?.({ ...baseline, [name]: value }, variable);
  }

  async function calculate(event) {
    event.preventDefault();
    if (loading) return;
    setResults(null);
    onAnalysisChange?.(null);
    const validationError = validateBase(baseline);
    if (validationError) {
      setError(validationError);
      return;
    }

    const base = Object.fromEntries(
      Object.entries(baseline).map(([key, value]) => [key, Number(value)]),
    );
    setLoading(true);
    setError("");
    try {
      const rows = await calculateSensitivityResults(base, variable);
      setResults(rows);
      onAnalysisComplete?.(rows);
    } catch (requestError) {
      setError(requestError.message || "Sensitivity calculations could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-content analysis-page">
      <p className="eyebrow">EXPLORE ONE ASSUMPTION</p>
      <h1>Sensitivity Analysis</h1>
      <p className="analysis-intro">
        This is deterministic what-if analysis, not a prediction. Edit the baseline values,
        select one assumption, and compare backend calculations at -20%, -10%, baseline, +10%, and +20%.
        Defaults use your latest successful monthly calculation when available, otherwise illustrative starter assumptions.
      </p>
      <form className="sensitivity-form" onSubmit={calculate} noValidate>
        <div className="analysis-fields baseline-fields">
          {assumptions.map(([name, label]) => (
            <div className="form-field" key={name}>
              <label htmlFor={`sensitivity-${name}`}>{label}</label>
              <input
                id={`sensitivity-${name}`}
                name={name}
                type="number"
                min="0"
                step={name === "unitsSoldPerMonth" ? "1" : "any"}
                value={baseline[name] ?? ""}
                onChange={updateBaseline}
                disabled={loading}
                required
              />
            </div>
          ))}
        </div>
        <div className="form-field variable-selector">
          <label htmlFor="sensitivity-variable">Assumption to vary</label>
          <select
            id="sensitivity-variable"
            value={variable}
            disabled={loading}
            onChange={(event) => {
              setVariable(event.target.value);
              setResults(null);
              setError("");
              onAnalysisChange?.(null);
              onInputsChange?.(baseline, event.target.value);
            }}
          >
            {assumptions.map(([name, label]) => <option key={name} value={name}>{label}</option>)}
          </select>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="analysis-actions">
          <button className="calculate-button" type="submit" disabled={loading}>
            {loading ? "Calculating sensitivity…" : "Calculate sensitivity"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
          <span>Ten backend calculations are requested on submit.</span>
        </div>
      </form>
      <p className="currency-note">All amounts are illustrative currency units. Units sold remain whole and non-negative.</p>
      {results ? (
        <>
          <div className="table-wrap">
            <table className="sensitivity-table">
              <caption>{selectedLabel}: impact of changing one assumption</caption>
              <thead>
                <tr>
                  <th scope="col">Change</th>
                  <th scope="col">{selectedLabel}</th>
                  <th scope="col">Revenue</th>
                  <th scope="col">Operating expenses</th>
                  <th scope="col">Profit / loss</th>
                  <th scope="col">Margin</th>
                  <th scope="col">Break-even</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => {
                  const negative = row.result.monthlyOperatingProfitOrLoss < 0;
                  return (
                    <tr key={row.percent} className={row.percent === 0 ? "baseline-row" : ""}>
                      <th scope="row">{row.changeLabel}</th>
                      <td>
                        {variable === "unitsSoldPerMonth"
                          ? new Intl.NumberFormat().format(row.variedValue)
                          : formatMoney(row.variedValue)}
                      </td>
                      <td>{formatMoney(row.result.monthlyRevenue)}</td>
                      <td>{formatMoney(row.result.totalOperatingExpenses)}</td>
                      <td className={negative ? "negative-value" : "positive-value"}>
                        {negative ? "Loss " : "Profit "}{formatMoney(Math.abs(row.result.monthlyOperatingProfitOrLoss))}
                      </td>
                      <td>{row.result.profitMarginPercentage === null ? "—" : `${row.result.profitMarginPercentage.toFixed(2)}%`}</td>
                      <td>
                        {row.breakEven.canBreakEven
                          ? `${row.breakEven.breakEvenUnits} units`
                          : "Not achievable"}
                        {!row.breakEven.canBreakEven && (
                          <span className="table-note" title={row.breakEven.message}>†</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {results.some((row) => !row.breakEven.canBreakEven) && (
              <p className="chart-note">
                † Break-even is not achievable at the current contribution per unit. The backend returned no break-even unit estimate for those variations.
              </p>
            )}
          </div>
          <SensitivityChart rows={results} valueLabel={selectedLabel} />
        </>
      ) : (
        <div className="analysis-empty">
          <h2>Sensitivity results will appear here</h2>
          <p>Submit your baseline and selected assumption to calculate the five variations.</p>
        </div>
      )}
    </div>
  );
}
