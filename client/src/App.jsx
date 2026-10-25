import { useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./components/AuthPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import {
  calculateBreakEven,
  calculateMonthlyFinancials,
  calculateStartupCost,
} from "./services/api.js";
import MonthlyCharts from "./components/MonthlyCharts.jsx";
import ScenarioAnalysis from "./components/ScenarioAnalysis.jsx";
import SensitivityAnalysis from "./components/SensitivityAnalysis.jsx";
import Reports from "./components/Reports.jsx";
import { calculateScenarioResults, calculateSensitivityResults } from "./services/analysis.js";

const navigation = [
  { label: "Dashboard", icon: "▦" },
  { label: "Startup Costs", icon: "＋" },
  { label: "Profit & Loss", icon: "↗" },
  { label: "Break-Even Analysis", icon: "◎" },
  { label: "Scenario Analysis", icon: "◇" },
  { label: "Sensitivity Analysis", icon: "±" },
  { label: "Reports", icon: "▤" },
];

const startupFields = [
  ["equipment", "Equipment"],
  ["furniture", "Furniture"],
  ["renovation", "Renovation"],
  ["registrationAndLicenses", "Registration and licenses"],
  ["initialInventory", "Initial inventory"],
  ["shopDeposit", "Shop deposit"],
  ["otherStartupCosts", "Other startup costs"],
];

const monthlyFields = [
  ["sellingPricePerUnit", "Selling price per unit"],
  ["unitsSoldPerMonth", "Units sold per month", "whole"],
  ["variableCostPerUnit", "Variable cost per unit"],
  ["monthlyRent", "Monthly rent"],
  ["salaries", "Salaries"],
  ["utilities", "Utilities"],
  ["marketing", "Marketing"],
  ["otherFixedMonthlyExpenses", "Other fixed monthly expenses"],
];

const breakEvenFields = [
  ["sellingPricePerUnit", "Selling price per unit"],
  ["variableCostPerUnit", "Variable cost per unit"],
  ["fixedMonthlyExpenses", "Total fixed monthly expenses"],
];

const emptyValues = (fields) => Object.fromEntries(fields.map(([name]) => [name, ""]));

function normalizeFormValues(values, fields) {
  const source =
    values && typeof values === "object" && !Array.isArray(values) ? values : {};
  return Object.fromEntries(
    fields.map(([name, , type]) => {
      const raw = source[name];
      if (typeof raw !== "number" && typeof raw !== "string") return [name, ""];
      if (typeof raw === "string" && raw.trim() === "") return [name, ""];
      const number = Number(raw);
      if (
        !Number.isFinite(number) ||
        number < 0 ||
        (type === "whole" && !Number.isSafeInteger(number))
      ) {
        return [name, ""];
      }
      return [name, String(number)];
    }),
  );
}

function validateValues(values, fields) {
  for (const [name, label, type] of fields) {
    const rawValue = values[name];
    if (rawValue === "") {
      return `${label} is required.`;
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) {
      return `${label} must be a finite, non-negative number.`;
    }
    if (type === "whole" && !Number.isSafeInteger(value)) {
      return `${label} must be a non-negative whole number.`;
    }
  }
  return "";
}

function toNumbers(values) {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, Number(value)]));
}

function money(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function NumberField({ name, label, value, onChange, hint, whole = false, disabled = false }) {
  const id = `field-${name}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          id={id}
          name={name}
          type="number"
          min="0"
          step={whole ? "1" : "any"}
          inputMode={whole ? "numeric" : "decimal"}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          required
        />
      </div>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

function CalculationForm({
  fields,
  initialValues,
  onValuesChange,
  onCalculate,
  onCalculated,
  description,
  submitLabel,
  results,
}) {
  const [values, setValues] = useState(
    () => initialValues ?? emptyValues(fields),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function updateField(event) {
    const { name, value } = event.target;
    const updated = { ...values, [name]: value };
    setValues(updated);
    onValuesChange?.(updated);
    setResult(null);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setResult(null);
    const validationError = validateValues(values, fields);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const numericValues = toNumbers(values);
      const calculated = await onCalculate(numericValues);
      setResult(calculated);
      onCalculated?.(calculated, numericValues);
    } catch (requestError) {
      setError(requestError.message || "The calculation could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="calculator-layout">
      <form className="calculator-form" onSubmit={submit} noValidate>
        <p className="form-description">{description}</p>
        <div className="form-grid">
          {fields.map(([name, label, type]) => (
            <NumberField
              key={name}
              name={name}
              label={label}
              value={values[name] ?? ""}
              onChange={updateField}
              disabled={loading}
              whole={type === "whole"}
              hint={type === "whole" ? "Enter a whole number." : ""}
            />
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            <span aria-hidden="true">!</span> {error}
          </p>
        )}
        <button className="calculate-button" type="submit" disabled={loading}>
          {loading ? "Calculating…" : submitLabel}
          {!loading && <span aria-hidden="true">→</span>}
        </button>
        <p className="form-footnote">Results are calculated by the project API. Edit values and calculate again any time.</p>
      </form>

      <section className={`results-panel${result ? " has-result" : ""}`} aria-live="polite">
        {result ? (
          results(result)
        ) : (
          <div className="empty-result">
            <span className="result-symbol" aria-hidden="true">◎</span>
            <h2>Your results will appear here</h2>
            <p>Enter your figures and submit the form to calculate using the backend.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, emphasis = false, tone = "" }) {
  return (
    <div className={`result-metric${emphasis ? " emphasis" : ""}`}>
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function StartupResults({ result }) {
  return (
    <>
      <p className="eyebrow">CALCULATION COMPLETE</p>
      <h2>Initial investment</h2>
      <p className="result-context">One-time startup costs. These are not recurring monthly expenses.</p>
      <div className="primary-result">
        <span>Total initial investment</span>
        <strong>{money(result.totalInitialInvestment)}</strong>
      </div>
      <p className="api-confirmation">Calculated successfully by the project API</p>
    </>
  );
}

function MonthlyResults({ result, onBreakEvenCalculated }) {
  const isProfit = result.monthlyOperatingProfitOrLoss >= 0;
  return (
    <>
      <p className="eyebrow">CALCULATION COMPLETE</p>
      <h2>Monthly summary</h2>
      <p className="result-context">Recurring operating figures. One-time startup costs are excluded.</p>
      <div className="primary-result">
        <span>{isProfit ? "Operating profit" : "Operating loss"}</span>
        <strong className={isProfit ? "positive-value" : "negative-value"}>
          {money(Math.abs(result.monthlyOperatingProfitOrLoss))}
        </strong>
      </div>
      <div className="result-list">
        <Metric label="Monthly revenue" value={money(result.monthlyRevenue)} />
        <Metric label="Variable expenses" value={money(result.totalVariableExpenses)} />
        <Metric label="Total operating expenses" value={money(result.totalOperatingExpenses)} />
        <Metric
          label="Profit margin"
          value={result.profitMarginPercentage === null ? "— (no revenue)" : `${result.profitMarginPercentage.toFixed(2)}%`}
        />
      </div>
      <p className="api-confirmation">Calculated successfully by the project API</p>
      <MonthlyCharts result={result} onBreakEvenCalculated={onBreakEvenCalculated} />
    </>
  );
}

function BreakEvenResults({ result }) {
  return (
    <>
      <p className="eyebrow">CALCULATION COMPLETE</p>
      <h2>Break-even analysis</h2>
      {result.canBreakEven ? (
        <>
          <p className="result-context">Based on the selling price, variable cost, and fixed monthly expenses entered.</p>
          <div className="primary-result">
            <span>Break-even units</span>
            <strong>{new Intl.NumberFormat().format(result.breakEvenUnits)} units</strong>
          </div>
          <div className="result-list">
            <Metric label="Contribution per unit" value={money(result.contributionPerUnit)} />
            <Metric label="Break-even revenue" value={money(result.breakEvenRevenue)} />
          </div>
        </>
      ) : (
        <div className="break-even-warning" role="status">
          <strong>Break-even cannot be reached through additional sales</strong>
          <p>{result.message}</p>
          <Metric label="Contribution per unit" value={money(result.contributionPerUnit)} />
        </div>
      )}
      <p className="api-confirmation">Calculated successfully by the project API</p>
    </>
  );
}

function Dashboard({ onNavigate, startupResult, monthlyResult, breakEvenResult }) {
  const cards = [
    ["Startup Costs", "Estimate your one-time setup investment.", "＋"],
    ["Profit & Loss", "See monthly revenue, expenses, and profit or loss.", "↗"],
    ["Break-Even Analysis", "Find the sales volume needed to cover fixed costs.", "◎"],
  ];

  return (
    <div className="page-content">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">YOUR BUSINESS, AT A GLANCE</p>
          <h1>Startup Cost and<br className="desktop-break" /> Profitability Analysis System</h1>
          <p className="intro">
            Estimate startup costs, monthly profit or loss, and your break-even point with calculations from the project API.
          </p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-card">
            <span className="art-card-label">YOUR NEXT BIG IDEA</span>
            <span className="art-card-line" />
            <span className="art-card-line short" />
          </div>
          <span className="art-spark spark-one">✦</span>
          <span className="art-spark spark-two">✳</span>
        </div>
      </section>
      <section className="section-heading">
        <div>
          <p className="eyebrow">FINANCIAL TOOLS</p>
          <h2>Choose a calculation</h2>
        </div>
        <span className="planned-label"><span /> READY TO USE</span>
      </section>
      <section className="module-grid" aria-label="Financial tools">
        {cards.map(([label, detail, icon], index) => (
          <button className="module-card dashboard-card" key={label} onClick={() => onNavigate(label)} type="button">
            <span className={`module-icon icon-${index}`} aria-hidden="true">{icon}</span>
            <span className="module-kicker">0{index + 1} / CALCULATOR</span>
            <strong>{label}</strong>
            <span className="dashboard-card-description">{detail}</span>
            <span className="module-card-footer">Open calculator <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </section>
      <section className="section-heading">
        <div>
          <p className="eyebrow">WHAT-IF TOOLS</p>
          <h2>Explore different assumptions</h2>
        </div>
      </section>
      <section className="module-grid" aria-label="Analysis tools">
        {[
          ["Scenario Analysis", "Compare best, expected, and worst case assumptions.", "◇"],
          ["Sensitivity Analysis", "See how one changing input affects the results.", "±"],
        ].map(([label, detail, icon], index) => (
          <button className="module-card dashboard-card" key={label} onClick={() => onNavigate(label)} type="button">
            <span className={`module-icon icon-${index + 1}`} aria-hidden="true">{icon}</span>
            <span className="module-kicker">0{index + 4} / WHAT-IF</span>
            <strong>{label}</strong>
            <span className="dashboard-card-description">{detail}</span>
            <span className="module-card-footer">Open analysis <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </section>
      {(startupResult || monthlyResult || breakEvenResult) && (
        <>
          <section className="section-heading">
            <div>
              <p className="eyebrow">LATEST CALCULATIONS</p>
              <h2>Current plan snapshot</h2>
            </div>
          </section>
          <section className="dashboard-snapshot" aria-label="Latest calculated values">
            {startupResult && (
              <div><span>Initial investment · one-time</span><strong>{money(startupResult.totalInitialInvestment)}</strong></div>
            )}
            {monthlyResult && (
              <>
                <div><span>Monthly revenue</span><strong>{money(monthlyResult.monthlyRevenue)}</strong></div>
                <div>
                  <span>{monthlyResult.monthlyOperatingProfitOrLoss < 0 ? "Monthly operating loss" : "Monthly operating profit"}</span>
                  <strong className={monthlyResult.monthlyOperatingProfitOrLoss < 0 ? "negative-value" : "positive-value"}>
                    {money(Math.abs(monthlyResult.monthlyOperatingProfitOrLoss))}
                  </strong>
                </div>
              </>
            )}
            {breakEvenResult && (
              <div>
                <span>Break-even</span>
                <strong>{breakEvenResult.canBreakEven ? `${new Intl.NumberFormat().format(breakEvenResult.breakEvenUnits)} units` : "Not achievable"}</strong>
              </div>
            )}
          </section>
        </>
      )}
      <section className="bottom-panel">
        <div className="bottom-icon" aria-hidden="true">✳</div>
        <div>
          <p className="eyebrow">YOUR FIGURES, YOUR PLAN</p>
          <h2>Calculations come from your entered values.</h2>
          <p>No results are shown until a calculator successfully responds.</p>
        </div>
        <div className="bottom-decoration" aria-hidden="true">01</div>
      </section>
      <footer className="page-footer">A simple workspace for your next big idea.</footer>
    </div>
  );
}

function ProtectedApp() {
  const { user, logout } = useAuth();
  const [activePage, setActivePage] = useState("Dashboard");
  const [helpOpen, setHelpOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [latestMonthlyBase, setLatestMonthlyBase] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [planName, setPlanName] = useState("My startup plan");
  const [startupInputs, setStartupInputs] = useState(() => emptyValues(startupFields));
  const [monthlyInputs, setMonthlyInputs] = useState(() => emptyValues(monthlyFields));
  const [breakEvenInputs, setBreakEvenInputs] = useState(() => emptyValues(breakEvenFields));
  const [startupResult, setStartupResult] = useState(null);
  const [monthlyResult, setMonthlyResult] = useState(null);
  const [breakEvenResult, setBreakEvenResult] = useState(null);
  const [scenarioInputs, setScenarioInputs] = useState(null);
  const [scenarioResults, setScenarioResults] = useState(null);
  const [sensitivityBaseline, setSensitivityBaseline] = useState(null);
  const [sensitivityVariable, setSensitivityVariable] = useState("sellingPricePerUnit");
  const [sensitivityResults, setSensitivityResults] = useState(null);

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
    } catch (error) {
      setLogoutError(error.message || "Logout could not be completed. Please try again.");
    }
  }

  function setInputValues(setter, values, clearResult) {
    setter(values);
    clearResult(null);
  }

  async function loadSavedPlan(savedPlan) {
    const savedInputs = savedPlan.inputs ?? {};
    const normalizedStartup = normalizeFormValues(savedInputs.startup, startupFields);
    const normalizedMonthly = normalizeFormValues(savedInputs.monthly, monthlyFields);
    const normalizedBreakEven = normalizeFormValues(savedInputs.breakEven, breakEvenFields);
    const normalizedScenarios =
      Array.isArray(savedPlan.scenarioInputs) &&
      savedPlan.scenarioInputs.length === 3 &&
      savedPlan.scenarioInputs.every((scenario) => scenario && typeof scenario === "object" && !Array.isArray(scenario))
        ? savedPlan.scenarioInputs.map((scenario) =>
            normalizeFormValues(scenario, [
              ["sellingPricePerUnit", "Selling price per unit"],
              ["unitsSoldPerMonth", "Units sold per month", "whole"],
              ["variableCostPerUnit", "Variable cost per unit"],
              ["fixedMonthlyExpenses", "Fixed monthly expenses"],
            ]),
          )
        : null;
    const normalizedSensitivity =
      savedPlan.sensitivityBaseline && typeof savedPlan.sensitivityBaseline === "object"
        ? normalizeFormValues(savedPlan.sensitivityBaseline, [
            ["sellingPricePerUnit", "Selling price per unit"],
            ["unitsSoldPerMonth", "Units sold per month", "whole"],
            ["variableCostPerUnit", "Variable cost per unit"],
            ["fixedMonthlyExpenses", "Fixed monthly expenses"],
          ])
        : null;

    setBusinessName(typeof savedPlan.businessName === "string" ? savedPlan.businessName : "");
    setPlanName(savedPlan.name);
    setStartupInputs(normalizedStartup);
    setMonthlyInputs(normalizedMonthly);
    setBreakEvenInputs(normalizedBreakEven);
    setScenarioInputs(normalizedScenarios);
    setSensitivityBaseline(normalizedSensitivity);
    const validSensitivityVariables = [
      "sellingPricePerUnit",
      "unitsSoldPerMonth",
      "variableCostPerUnit",
      "fixedMonthlyExpenses",
    ];
    const restoredSensitivityVariable = validSensitivityVariables.includes(savedPlan.sensitivityVariable)
      ? savedPlan.sensitivityVariable
      : "sellingPricePerUnit";
    setSensitivityVariable(restoredSensitivityVariable);
    setStartupResult(null);
    setMonthlyResult(null);
    setBreakEvenResult(null);
    setScenarioResults(null);
    setSensitivityResults(null);
    setLatestMonthlyBase(null);

    const failures = [];
    const isComplete = (values, fields) =>
      fields.every(([key]) => {
        const value = values[key];
        return value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
      });

    if (isComplete(normalizedStartup, startupFields)) {
      try {
        setStartupResult(await calculateStartupCost(toNumbers(normalizedStartup)));
      } catch (error) {
        failures.push(`Startup costs: ${error.message}`);
      }
    }

    if (isComplete(normalizedMonthly, monthlyFields)) {
      try {
        const monthly = await calculateMonthlyFinancials(toNumbers(normalizedMonthly));
        setMonthlyResult(monthly);
        const base = {
          sellingPricePerUnit: monthly.sellingPricePerUnit,
          unitsSoldPerMonth: monthly.unitsSoldPerMonth,
          variableCostPerUnit: monthly.variableCostPerUnit,
          fixedMonthlyExpenses: monthly.fixedMonthlyExpenses,
        };
        setLatestMonthlyBase(base);
        const beInputs = {
          sellingPricePerUnit: base.sellingPricePerUnit,
          variableCostPerUnit: base.variableCostPerUnit,
          fixedMonthlyExpenses: base.fixedMonthlyExpenses,
        };
        setBreakEvenInputs(beInputs);
        setBreakEvenResult(await calculateBreakEven(beInputs));
      } catch (error) {
        failures.push(`Monthly results: ${error.message}`);
      }
    } else if (isComplete(normalizedBreakEven, breakEvenFields)) {
      try {
        setBreakEvenResult(await calculateBreakEven(toNumbers(normalizedBreakEven)));
      } catch (error) {
        failures.push(`Break-even: ${error.message}`);
      }
    }

    if (
      normalizedScenarios?.length === 3 &&
      normalizedScenarios.every((scenario) =>
        ["sellingPricePerUnit", "unitsSoldPerMonth", "variableCostPerUnit", "fixedMonthlyExpenses"]
          .every((key) => scenario[key] !== "" && Number.isFinite(Number(scenario[key])) && Number(scenario[key]) >= 0),
      )
    ) {
      try {
        setScenarioResults(await calculateScenarioResults(normalizedScenarios));
      } catch (error) {
        failures.push(`Scenario results: ${error.message}`);
      }
    }

    if (
      normalizedSensitivity &&
      ["sellingPricePerUnit", "unitsSoldPerMonth", "variableCostPerUnit", "fixedMonthlyExpenses"]
        .every((key) => normalizedSensitivity[key] !== "" && Number.isFinite(Number(normalizedSensitivity[key])) && Number(normalizedSensitivity[key]) >= 0)
    ) {
      try {
        setSensitivityResults(
          await calculateSensitivityResults(
            Object.fromEntries(Object.entries(normalizedSensitivity).map(([key, value]) => [key, Number(value)])),
            restoredSensitivityVariable,
          ),
        );
      } catch (error) {
        failures.push(`Sensitivity results: ${error.message}`);
      }
    }

    if (failures.length) {
      throw new Error(`Plan inputs were restored, but some results could not be recalculated: ${failures.join("; ")}`);
    }
  }

  function renderPage() {
    if (activePage === "Dashboard") {
      return (
        <Dashboard
          onNavigate={setActivePage}
          startupResult={startupResult}
          monthlyResult={monthlyResult}
          breakEvenResult={breakEvenResult}
        />
      );
    }
    if (activePage === "Startup Costs") {
      return (
        <CalculatorPage
          eyebrow="ONE-TIME INVESTMENT"
          title="Startup Costs"
          description="Enter each one-time startup expense. These costs are separate from your recurring monthly operating expenses."
          fields={startupFields}
          initialValues={startupInputs}
          onValuesChange={(values) => setInputValues(setStartupInputs, values, setStartupResult)}
          submitLabel="Calculate Startup Investment"
          onCalculate={calculateStartupCost}
          onCalculated={(result) => setStartupResult(result)}
          results={(result) => <StartupResults result={result} />}
        />
      );
    }
    if (activePage === "Profit & Loss") {
      return (
        <CalculatorPage
          eyebrow="MONTHLY PERFORMANCE"
          title="Profit & Loss"
          description="Enter monthly sales and recurring costs. Startup investment is not counted as a monthly expense."
          fields={monthlyFields}
          initialValues={monthlyInputs}
          onValuesChange={(values) => {
            setInputValues(setMonthlyInputs, values, setMonthlyResult);
            setLatestMonthlyBase(null);
            setBreakEvenResult(null);
          }}
          submitLabel="Calculate Monthly Profit & Loss"
          onCalculate={calculateMonthlyFinancials}
          onCalculated={(result, values) => {
            setMonthlyResult(result);
            setLatestMonthlyBase({
              sellingPricePerUnit: values.sellingPricePerUnit,
              unitsSoldPerMonth: values.unitsSoldPerMonth,
              variableCostPerUnit: values.variableCostPerUnit,
              fixedMonthlyExpenses: result.fixedMonthlyExpenses,
            });
            setBreakEvenInputs({
              sellingPricePerUnit: values.sellingPricePerUnit,
              variableCostPerUnit: values.variableCostPerUnit,
              fixedMonthlyExpenses: result.fixedMonthlyExpenses,
            });
          }}
          results={(result) => (
            <MonthlyResults result={result} onBreakEvenCalculated={setBreakEvenResult} />
          )}
        />
      );
    }
    if (activePage === "Break-Even Analysis") {
      return (
        <CalculatorPage
          eyebrow="SALES TARGET"
          title="Break-Even Analysis"
          description="Use the same selling price and variable cost inputs as your monthly plan, plus total fixed monthly expenses."
          fields={breakEvenFields}
          initialValues={breakEvenInputs}
          onValuesChange={(values) => setInputValues(setBreakEvenInputs, values, setBreakEvenResult)}
          submitLabel="Calculate Break-Even"
          onCalculate={calculateBreakEven}
          onCalculated={(result) => setBreakEvenResult(result)}
          results={(result) => <BreakEvenResults result={result} />}
        />
      );
    }
    if (activePage === "Scenario Analysis") {
      return (
        <ScenarioAnalysis
          baseValues={latestMonthlyBase}
          initialScenarios={scenarioInputs}
          onInputsChange={(values) => setScenarioInputs(values)}
          onAnalysisChange={setScenarioResults}
          onAnalysisComplete={setScenarioResults}
        />
      );
    }
    if (activePage === "Sensitivity Analysis") {
      return (
        <SensitivityAnalysis
          baseValues={latestMonthlyBase}
          initialBaseline={sensitivityBaseline}
          initialVariable={sensitivityVariable}
          onInputsChange={(values, variable) => {
            setSensitivityBaseline(values);
            setSensitivityVariable(variable);
          }}
          onAnalysisChange={setSensitivityResults}
          onAnalysisComplete={setSensitivityResults}
        />
      );
    }
    if (activePage === "Reports") {
      return (
        <Reports
          key={user.id}
          userId={user.id}
          data={{
            businessName,
            planName,
            inputs: {
              startup: startupInputs,
              monthly: monthlyInputs,
              breakEven: breakEvenInputs,
            },
            results: {
              startup: startupResult,
              monthly: monthlyResult,
              breakEven: breakEvenResult,
            },
            scenarioInputs,
            scenarioResults,
            sensitivityBaseline,
            sensitivityVariable,
            sensitivityVariableLabel: {
              sellingPricePerUnit: "Selling price per unit",
              unitsSoldPerMonth: "Monthly units sold",
              variableCostPerUnit: "Variable cost per unit",
              fixedMonthlyExpenses: "Fixed monthly expenses",
            }[sensitivityVariable],
            sensitivityResults,
          }}
          onBusinessNameChange={setBusinessName}
          onLoadPlan={loadSavedPlan}
        />
      );
    }
    return (
      <div className="page-content placeholder-content">
        <p className="eyebrow">WORKSPACE MODULE</p>
        <h1>{activePage}</h1>
        <section className="placeholder-card">
          <div className="placeholder-icon" aria-hidden="true">✳</div>
          <h2>This section is planned for a later step</h2>
          <p>{activePage} is not implemented yet.</p>
          <span className="placeholder-label">This section is not available</span>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setActivePage("Dashboard")}>
          <span className="brand-mark" aria-hidden="true">S</span>
          <span className="brand-copy">
            <strong>Foundry</strong>
            <small>STARTUP PLANNER</small>
          </span>
        </button>
        <div className="nav-heading">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              className={`nav-item${activePage === item.label ? " active" : ""}`}
              key={item.label}
              onClick={() => setActivePage(item.label)}
              type="button"
              aria-current={activePage === item.label ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.label !== "Dashboard" && <span className="nav-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar" aria-hidden="true">{user.name.slice(0, 2).toUpperCase()}</div>
          <div className="profile-copy">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="logout-button" type="button" onClick={() => void handleLogout()}>Log out</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {activePage}</div>
          <div className="topbar-right">
            <span className="topbar-user">{user.name}</span>
            <button className="logout-topbar" type="button" onClick={() => void handleLogout()}>Log out</button>
            <button
              className="help-button"
              type="button"
              aria-label="Project help"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen((open) => !open)}
            >
              ?
            </button>
          </div>
        </header>
        {helpOpen && (
          <aside className="help-popover" aria-label="Project help">
            <button className="help-close" type="button" aria-label="Close help" onClick={() => setHelpOpen(false)}>×</button>
            <strong>Planning workspace help</strong>
            <p>Enter assumptions in a calculator and submit to request real results from the local project API.</p>
            <p>Use Reports to download results or save a plan in this browser.</p>
          </aside>
        )}
        {logoutError && <p className="form-error logout-error" role="alert">{logoutError}</p>}
        {renderPage()}
      </main>
    </div>
  );
}

function CalculatorPage({
  eyebrow,
  title,
  description,
  fields,
  initialValues,
  onValuesChange,
  submitLabel,
  onCalculate,
  onCalculated,
  results,
}) {
  return (
    <div className="page-content calculator-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <CalculationForm
        key={title}
        fields={fields}
        initialValues={initialValues}
        onValuesChange={onValuesChange}
        onCalculate={onCalculate}
        onCalculated={onCalculated}
        description={description}
        submitLabel={submitLabel}
        results={results}
      />
    </div>
  );
}

export default function App() {
  return (
    <ProtectedRoute fallback={<AuthPage />}>
      <ProtectedApp />
    </ProtectedRoute>
  );
}
