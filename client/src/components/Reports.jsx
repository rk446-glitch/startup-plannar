import { useMemo, useState } from "react";

const STORAGE_KEY = "foundry-startup-plans";
const STORAGE_VERSION = 1;
const startupLabels = [
  ["equipment", "Equipment"],
  ["furniture", "Furniture"],
  ["renovation", "Renovation"],
  ["registrationAndLicenses", "Registration and licenses"],
  ["initialInventory", "Initial inventory"],
  ["shopDeposit", "Shop deposit"],
  ["otherStartupCosts", "Other startup costs"],
];

const formatAmount = (value) =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const formatInteger = (value) => new Intl.NumberFormat().format(value);
const dateTime = (value = new Date()) => new Date(value).toLocaleString();
const slug = (value) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "startup-plan";

function readPlans(userId) {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return { plans: [], error: "" };
    const saved = JSON.parse(raw);
    if (saved.version !== STORAGE_VERSION || !Array.isArray(saved.plans)) {
      return { plans: [], error: "Saved plan data is from an unsupported format and was not loaded." };
    }
    const validPlans = saved.plans.filter(
      (plan) =>
        plan &&
        typeof plan.id === "string" &&
        typeof plan.name === "string" &&
        plan.ownerId === userId &&
        plan.inputs &&
        typeof plan.inputs === "object",
    );
    return {
      plans: validPlans,
      error: validPlans.length === saved.plans.length ? "" : "Some invalid saved plan entries were ignored.",
    };
  } catch {
    return { plans: [], error: "Saved plans could not be read. Browser storage may be unavailable or contain invalid data." };
  }
}

function savePlans(userId, plans) {
  window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify({ version: STORAGE_VERSION, plans }));
}

function hasResults(data) {
  return Boolean(
    data.results.startup ||
      data.results.monthly ||
      data.results.breakEven ||
      data.scenarioResults?.length ||
      data.sensitivityResults?.length,
  );
}

function createRows(data, generatedAt) {
  const provided = (value) => value !== undefined && value !== null && value !== "";
  const rows = [["Section", "Item", "Value", "Notes"]];
  rows.push(["Report", "Business or plan name", data.businessName || data.planName, ""]);
  rows.push(["Report", "Generated", dateTime(generatedAt), ""]);
  rows.push(["Report", "Currency", "Illustrative currency units", "No currency has been selected"]);

  const startupHasInputs = startupLabels.some(([key]) => provided(data.inputs.startup?.[key]));
  if (data.results.startup || startupHasInputs) {
    const calculated = Boolean(data.results.startup);
    rows.push(["One-time startup costs", "Cost type", "Amount", ""]);
    for (const [key, label] of startupLabels) {
      const resultValue = data.results.startup?.itemizedCosts?.[key];
      const inputValue = Number(data.inputs.startup?.[key]);
      const value = Number.isFinite(resultValue) ? resultValue : inputValue;
      if (Number.isFinite(value) && (calculated || provided(data.inputs.startup?.[key]))) {
        rows.push([
          "One-time startup costs",
          label,
          formatAmount(value),
          calculated ? "One-time; not a monthly expense" : "Entered input; not calculated",
        ]);
      }
    }
    if (data.results.startup) {
      rows.push(["One-time startup costs", "Total initial investment", formatAmount(data.results.startup.totalInitialInvestment), ""]);
    }
  }

  const monthlyInputFields = [
    ["sellingPricePerUnit", "Selling price per unit"],
    ["unitsSoldPerMonth", "Units sold per month"],
    ["variableCostPerUnit", "Variable cost per unit"],
    ["monthlyRent", "Monthly rent"],
    ["salaries", "Salaries"],
    ["utilities", "Utilities"],
    ["marketing", "Marketing"],
    ["otherFixedMonthlyExpenses", "Other fixed monthly expenses"],
  ];
  const monthlyHasInputs = monthlyInputFields.some(([key]) => provided(data.inputs.monthly?.[key]));
  if (data.results.monthly || monthlyHasInputs) {
    const result = data.results.monthly;
    rows.push(["Monthly financials", "Item", "Value", ""]);
    for (const [key, label] of monthlyInputFields) {
      const value = Number(data.inputs.monthly?.[key]);
      if (Number.isFinite(value) && provided(data.inputs.monthly?.[key])) {
        rows.push(["Monthly financials", label, label === "Units sold per month" ? formatInteger(value) : formatAmount(value), "Recurring monthly input"]);
      }
    }
    if (result) {
      rows.push(["Monthly financials", "Fixed monthly expenses", formatAmount(result.fixedMonthlyExpenses), "Recurring monthly costs"]);
      rows.push(["Monthly financials", "Monthly revenue", formatAmount(result.monthlyRevenue), ""]);
      rows.push(["Monthly financials", "Variable expenses", formatAmount(result.totalVariableExpenses), ""]);
      rows.push(["Monthly financials", "Total operating expenses", formatAmount(result.totalOperatingExpenses), ""]);
      rows.push(["Monthly financials", "Monthly operating profit/loss", formatAmount(result.monthlyOperatingProfitOrLoss), ""]);
      rows.push(["Monthly financials", "Profit margin", result.profitMarginPercentage === null ? "Not available (zero revenue)" : `${result.profitMarginPercentage.toFixed(2)}%`, ""]);
    } else {
      rows.push(["Monthly financials", "Calculation status", "Inputs not calculated", "No monthly results included"]);
    }
  }

  const breakEvenHasInputs = ["sellingPricePerUnit", "variableCostPerUnit", "fixedMonthlyExpenses"]
    .some((key) => provided(data.inputs.breakEven?.[key]));
  if (data.results.breakEven || breakEvenHasInputs) {
    const result = data.results.breakEven;
    for (const [key, label] of [
      ["sellingPricePerUnit", "Selling price per unit"],
      ["variableCostPerUnit", "Variable cost per unit"],
      ["fixedMonthlyExpenses", "Fixed monthly expenses"],
    ]) {
      const value = Number(data.inputs.breakEven?.[key]);
      if (Number.isFinite(value) && provided(data.inputs.breakEven?.[key])) {
        rows.push(["Break-even analysis", label, formatAmount(value), "Input"]);
      }
    }
    if (result) {
      rows.push(["Break-even analysis", "Contribution per unit", formatAmount(result.contributionPerUnit), ""]);
      if (result.canBreakEven) {
        rows.push(["Break-even analysis", "Break-even units", formatInteger(result.breakEvenUnits), ""]);
        rows.push(["Break-even analysis", "Break-even revenue", formatAmount(result.breakEvenRevenue), ""]);
      } else {
        rows.push(["Break-even analysis", "Break-even status", result.message, ""]);
      }
    } else {
      rows.push(["Break-even analysis", "Calculation status", "Inputs not calculated", "No break-even results included"]);
    }
  }

  if (Array.isArray(data.scenarioInputs) && data.scenarioInputs.length) {
    for (const [index, assumptions] of data.scenarioInputs.entries()) {
      for (const [key, label, whole] of [
        ["sellingPricePerUnit", "selling price per unit", false],
        ["unitsSoldPerMonth", "units sold per month", true],
        ["variableCostPerUnit", "variable cost per unit", false],
        ["fixedMonthlyExpenses", "fixed monthly expenses", false],
      ]) {
        const value = Number(assumptions[key]);
        if (Number.isFinite(value) && provided(assumptions[key])) {
          rows.push([
            "Scenario assumptions",
            `${["Best case", "Expected case", "Worst case"][index]} — ${label}`,
            whole ? formatInteger(value) : formatAmount(value),
            "User-entered illustrative assumption",
          ]);
        }
      }
    }
  }

  if (Array.isArray(data.scenarioResults) && data.scenarioResults.length) {
    rows.push(["Scenario analysis", "Scenario", "Revenue | Expenses | Profit/Loss | Margin | Break-even", "User-defined assumptions; not predictions"]);
    for (const scenario of data.scenarioResults) {
      const result = scenario.result;
      rows.push([
        "Scenario analysis",
        scenario.label,
        [
          formatAmount(result.monthlyRevenue),
          formatAmount(result.totalOperatingExpenses),
          formatAmount(result.monthlyOperatingProfitOrLoss),
          result.profitMarginPercentage === null ? "N/A" : `${result.profitMarginPercentage.toFixed(2)}%`,
          scenario.breakEven.canBreakEven ? `${formatInteger(scenario.breakEven.breakEvenUnits)} units` : "Not achievable",
        ].join(" | "),
        "Calculated by the backend",
      ]);
    }
  }

  if (data.sensitivityBaseline) {
    for (const [key, label] of [
      ["sellingPricePerUnit", "Selling price per unit"],
      ["unitsSoldPerMonth", "Units sold per month"],
      ["variableCostPerUnit", "Variable cost per unit"],
      ["fixedMonthlyExpenses", "Fixed monthly expenses"],
    ]) {
      const value = Number(data.sensitivityBaseline?.[key]);
      if (Number.isFinite(value) && provided(data.sensitivityBaseline?.[key])) {
        rows.push(["Sensitivity baseline", label, key === "unitsSoldPerMonth" ? formatInteger(value) : formatAmount(value), "Baseline input"]);
      }
    }
  }

  if (Array.isArray(data.sensitivityResults) && data.sensitivityResults.length) {
    rows.push(["Sensitivity analysis", `${data.sensitivityVariableLabel} change`, "Changed input | Revenue | Expenses | Profit/Loss | Margin | Break-even", ""]);
    for (const row of data.sensitivityResults) {
      rows.push([
        "Sensitivity analysis",
        row.changeLabel,
        [
          formatAmount(row.variedValue),
          formatAmount(row.result.monthlyRevenue),
          formatAmount(row.result.totalOperatingExpenses),
          formatAmount(row.result.monthlyOperatingProfitOrLoss),
          row.result.profitMarginPercentage === null ? "N/A" : `${row.result.profitMarginPercentage.toFixed(2)}%`,
          row.breakEven.canBreakEven ? `${formatInteger(row.breakEven.breakEvenUnits)} units` : "Not achievable",
        ].join(" | "),
        "Deterministic backend calculation",
      ]);
    }
  }

  return rows;
}

function csvCell(value) {
  const rawText = String(value ?? "");
  const text = /^[\t\r ]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows, name) {
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(name)}-financial-report.csv`;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

async function downloadPdf(rows, name, generatedAt) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const left = 48;
  const width = pdf.internal.pageSize.getWidth() - left * 2;
  let y = 56;

  const writeLine = (text, options = {}) => {
    const { heading = false, bold = false } = options;
    pdf.setFont("helvetica", bold || heading ? "bold" : "normal");
    pdf.setFontSize(heading ? 13 : 9);
    const printableText = String(text).replace(/[–—]/g, "-").replace(/×/g, "x").replace(/−/g, "-");
    const lines = pdf.splitTextToSize(printableText, width);
    const lineHeight = heading ? 19 : 14;
    if (y + lines.length * lineHeight > pdf.internal.pageSize.getHeight() - 48) {
      pdf.addPage();
      y = 52;
    }
    pdf.text(lines, left, y);
    y += lines.length * lineHeight + (heading ? 3 : 1);
  };

  pdf.setTextColor(31, 91, 71);
  writeLine("Startup Cost and Profitability Analysis System", { heading: true });
  pdf.setTextColor(35, 45, 40);
  writeLine(`Business / plan: ${name}`, { bold: true });
  writeLine(`Report generated: ${dateTime(generatedAt)}`);
  writeLine("Currency: illustrative currency units (no currency selected)");
  y += 10;

  let currentSection = "";
  for (const [section, item, value, notes] of rows.slice(3)) {
    if (section !== currentSection) {
      currentSection = section;
      y += 7;
      pdf.setTextColor(31, 91, 71);
      writeLine(section, { heading: true });
      pdf.setTextColor(35, 45, 40);
    }
    writeLine(`${item}: ${value}${notes ? ` — ${notes}` : ""}`);
  }
  y += 10;
  pdf.setTextColor(90, 100, 94);
  writeLine("Methodology: Revenue = selling price × units sold. Variable costs = variable cost per unit × units sold. Operating profit/loss = revenue − operating expenses. Break-even uses the ceiling of fixed monthly expenses divided by positive contribution per unit.");
  writeLine("Assumptions: Results depend on user-entered values. Scenarios are illustrative assumptions, not predictions. This report presents operating calculations, not cash flow or return on investment.");
  pdf.save(`${slug(name)}-financial-report.pdf`);
}

export default function Reports({ data, userId, onBusinessNameChange, onLoadPlan }) {
  const [plansState, setPlansState] = useState(() => readPlans(userId));
  const [planName, setPlanName] = useState(data.planName || "My startup plan");
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState(plansState.error);
  const [loadingId, setLoadingId] = useState("");
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
  const rows = useMemo(() => createRows(data, generatedAt), [data, generatedAt]);
  const exportEnabled = hasResults(data);

  function persistPlans(plans) {
    try {
      savePlans(userId, plans);
      setPlansState({ plans, error: "" });
      setError("");
      return true;
    } catch {
      setError("Plans could not be saved. Browser storage may be unavailable or full.");
      return false;
    }
  }

  function savePlan(event) {
    event.preventDefault();
    const name = planName.trim();
    if (!name) {
      setError("Enter a name for this business plan.");
      return;
    }
    if (!hasResults(data) && !Object.values(data.inputs).some((values) => Object.values(values ?? {}).some((value) => value !== "" && value !== undefined))) {
      setError("Enter plan values or complete a calculation before saving.");
      return;
    }

    const duplicate = plansState.plans.find((plan) => plan.name.toLowerCase() === name.toLowerCase());
    if (duplicate && !window.confirm(`A plan named "${name}" already exists. Replace it?`)) return;
    const savedPlan = {
      version: STORAGE_VERSION,
      id: duplicate?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ownerId: userId,
      name,
      businessName: data.businessName,
      savedAt: new Date().toISOString(),
      inputs: data.inputs,
      scenarioInputs: data.scenarioInputs,
      sensitivityBaseline: data.sensitivityBaseline,
      sensitivityVariable: data.sensitivityVariable,
    };
    const plans = duplicate
      ? plansState.plans.map((plan) => (plan.id === duplicate.id ? savedPlan : plan))
      : [...plansState.plans, savedPlan];
    if (persistPlans(plans)) setPlanName(name);
  }

  async function loadPlan(plan) {
    if (plan.ownerId !== userId || !plan.inputs || typeof plan.inputs !== "object" || Array.isArray(plan.inputs)) {
      setError("This saved plan does not belong to the signed-in user or its input data is invalid.");
      return;
    }
    setLoadingId(plan.id);
    setError("");
    try {
      await onLoadPlan(plan);
      setPlanName(plan.name);
      setGeneratedAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError.message || "The saved plan could not be recalculated.");
    } finally {
      setLoadingId("");
    }
  }

  function renamePlan(plan) {
    const name = renameValue.trim();
    if (!name) {
      setError("A saved plan name cannot be empty.");
      return;
    }
    const duplicate = plansState.plans.some(
      (item) => item.id !== plan.id && item.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      setError("Another saved plan already uses that name.");
      return;
    }
    const plans = plansState.plans.map((item) =>
      item.id === plan.id ? { ...item, name } : item,
    );
    if (persistPlans(plans)) setRenamingId("");
  }

  function deletePlan(plan) {
    if (!window.confirm(`Delete "${plan.name}" from this browser?`)) return;
    persistPlans(plansState.plans.filter((item) => item.id !== plan.id));
  }

  async function exportReport(format) {
    if (!exportEnabled) return;
    const time = new Date().toISOString();
    setGeneratedAt(time);
    try {
      const reportRows = createRows(data, time);
      if (format === "csv") downloadCsv(reportRows, data.businessName || planName);
      else await downloadPdf(reportRows, data.businessName || planName, time);
      setError("");
    } catch {
      setError(`The ${format.toUpperCase()} report could not be generated in this browser.`);
    }
  }

  return (
    <div className="page-content analysis-page">
      <p className="eyebrow">YOUR FINANCIAL SUMMARY</p>
      <h1>Reports</h1>
      <p className="analysis-intro">
        Reports use only successfully calculated results. All amounts are illustrative currency units; select a real currency in a future version.
      </p>
      <section className="report-business-card">
        <div className="form-field">
          <label htmlFor="report-business-name">Business or plan name</label>
          <input
            id="report-business-name"
            type="text"
            maxLength="100"
            value={data.businessName}
            onChange={(event) => onBusinessNameChange(event.target.value)}
            placeholder="Name your business or plan"
          />
        </div>
        <div className="report-generated">Report generated: {dateTime(generatedAt)}</div>
      </section>

      {exportEnabled ? (
        <div className="report-sections">
          <ReportSummary data={data} />
          {data.scenarioResults?.length > 0 && <ReportScenarios rows={data.scenarioResults} />}
          {data.sensitivityResults?.length > 0 && (
            <ReportSensitivity
              rows={data.sensitivityResults}
              variableLabel={data.sensitivityVariableLabel}
            />
          )}
        </div>
      ) : (
        <div className="analysis-empty">
          <h2>No report results yet</h2>
          <p>Complete a calculator or analysis. Only successful calculations from the project API are included in reports.</p>
        </div>
      )}

      <section className="report-actions-card">
        <div>
          <h2>Download your report</h2>
          <p>Files are generated in your browser and are not uploaded or stored by the server.</p>
        </div>
        <div className="report-buttons">
          <button className="calculate-button" type="button" disabled={!exportEnabled} onClick={() => void exportReport("csv")}>
            Download CSV Report
          </button>
          <button className="secondary-button" type="button" disabled={!exportEnabled} onClick={() => void exportReport("pdf")}>
            Download Financial Report (PDF)
          </button>
        </div>
      </section>

      <section className="saved-plans-card">
        <div className="saved-plans-heading">
          <div>
            <p className="eyebrow">THIS BROWSER ONLY</p>
            <h2>Saved business plans</h2>
          </div>
          <p>Plans stay on this browser and device. Clearing browser data may remove them.</p>
        </div>
        <form className="save-plan-form" onSubmit={savePlan}>
          <div className="form-field">
            <label htmlFor="plan-name">Plan name</label>
            <input id="plan-name" value={planName} maxLength="100" onChange={(event) => setPlanName(event.target.value)} />
          </div>
          <button className="calculate-button" type="submit">Save current plan</button>
        </form>
        {plansState.plans.length ? (
          <div className="saved-plan-list">
            {plansState.plans.map((plan) => (
              <div className="saved-plan-row" key={plan.id}>
                <div className="saved-plan-info">
                  {renamingId === plan.id ? (
                    <form
                      className="rename-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        renamePlan(plan);
                      }}
                    >
                      <input aria-label={`New name for ${plan.name}`} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                      <button className="text-button" type="submit">Save name</button>
                      <button className="text-button" type="button" onClick={() => setRenamingId("")}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <strong>{plan.name}</strong>
                      <span>Saved {dateTime(plan.savedAt)}</span>
                    </>
                  )}
                </div>
                {renamingId !== plan.id && (
                  <div className="saved-plan-actions">
                    <button type="button" disabled={Boolean(loadingId)} onClick={() => loadPlan(plan)}>
                      {loadingId === plan.id ? "Loading…" : "Load"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(plan.id);
                        setRenameValue(plan.name);
                        setError("");
                      }}
                    >
                      Rename
                    </button>
                    <button type="button" onClick={() => deletePlan(plan)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="saved-plan-empty">No plans saved on this device yet.</p>
        )}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

function ReportSummary({ data }) {
  return (
    <>
      {data.results.startup && (
        <section className="report-section">
          <p className="eyebrow">ONE-TIME COSTS</p>
          <h2>Initial startup investment</h2>
          {startupLabels.map(([key, label]) => (
            <ReportMetric
              key={key}
              label={label}
              value={formatAmount(data.results.startup.itemizedCosts[key])}
            />
          ))}
          <ReportMetric label="Total initial investment" value={formatAmount(data.results.startup.totalInitialInvestment)} strong />
          <p className="report-footnote">These expenses are one-time amounts, not recurring monthly costs.</p>
        </section>
      )}
      {data.results.monthly && (
        <section className="report-section">
          <p className="eyebrow">RECURRING OPERATIONS</p>
          <h2>Monthly financial summary</h2>
          <ReportMetric label="Selling price per unit" value={formatAmount(data.results.monthly.sellingPricePerUnit)} />
          <ReportMetric label="Units sold per month" value={formatInteger(data.results.monthly.unitsSoldPerMonth)} />
          <ReportMetric label="Monthly revenue" value={formatAmount(data.results.monthly.monthlyRevenue)} />
          <ReportMetric label="Fixed monthly expenses" value={formatAmount(data.results.monthly.fixedMonthlyExpenses)} />
          <ReportMetric label="Variable expenses" value={formatAmount(data.results.monthly.totalVariableExpenses)} />
          <ReportMetric label="Total operating expenses" value={formatAmount(data.results.monthly.totalOperatingExpenses)} />
          <ReportMetric
            label={data.results.monthly.monthlyOperatingProfitOrLoss < 0 ? "Monthly operating loss" : "Monthly operating profit"}
            value={formatAmount(Math.abs(data.results.monthly.monthlyOperatingProfitOrLoss))}
            strong
            negative={data.results.monthly.monthlyOperatingProfitOrLoss < 0}
          />
          <ReportMetric label="Profit margin" value={data.results.monthly.profitMarginPercentage === null ? "Not available (zero revenue)" : `${data.results.monthly.profitMarginPercentage.toFixed(2)}%`} />
          <p className="report-footnote">Monthly expenses do not include the one-time startup investment. Operating profit is not cash flow or return on investment.</p>
        </section>
      )}
      {data.results.breakEven && (
        <section className="report-section">
          <p className="eyebrow">SALES TARGET</p>
          <h2>Break-even analysis</h2>
          <ReportMetric label="Contribution per unit" value={formatAmount(data.results.breakEven.contributionPerUnit)} />
          {data.results.breakEven.canBreakEven ? (
            <>
              <ReportMetric label="Break-even quantity" value={`${formatInteger(data.results.breakEven.breakEvenUnits)} units`} strong />
              <ReportMetric label="Break-even revenue" value={formatAmount(data.results.breakEven.breakEvenRevenue)} />
            </>
          ) : (
            <p className="break-even-report-warning">{data.results.breakEven.message}</p>
          )}
        </section>
      )}
    </>
  );
}

function ReportScenarios({ rows }) {
  return (
    <section className="report-section report-table-section">
      <p className="eyebrow">USER-DEFINED ASSUMPTIONS</p>
      <h2>Scenario comparison</h2>
      <div className="table-wrap">
        <table className="sensitivity-table">
          <thead><tr><th>Scenario</th><th>Revenue</th><th>Expenses</th><th>Profit/loss</th><th>Margin</th><th>Break-even</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th><td>{formatAmount(row.result.monthlyRevenue)}</td><td>{formatAmount(row.result.totalOperatingExpenses)}</td><td>{formatAmount(row.result.monthlyOperatingProfitOrLoss)}</td><td>{row.result.profitMarginPercentage === null ? "N/A" : `${row.result.profitMarginPercentage.toFixed(2)}%`}</td><td>{row.breakEven.canBreakEven ? `${formatInteger(row.breakEven.breakEvenUnits)} units` : "Not achievable"}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="report-footnote">These are editable assumptions, not forecasts or predictions.</p>
    </section>
  );
}

function ReportSensitivity({ rows, variableLabel }) {
  return (
    <section className="report-section report-table-section">
      <p className="eyebrow">DETERMINISTIC WHAT-IF ANALYSIS</p>
      <h2>Sensitivity: {variableLabel}</h2>
      <div className="table-wrap">
        <table className="sensitivity-table">
          <thead><tr><th>Change</th><th>Changed input</th><th>Revenue</th><th>Expenses</th><th>Profit/loss</th><th>Margin</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.changeLabel}><th>{row.changeLabel}</th><td>{formatAmount(row.variedValue)}</td><td>{formatAmount(row.result.monthlyRevenue)}</td><td>{formatAmount(row.result.totalOperatingExpenses)}</td><td>{formatAmount(row.result.monthlyOperatingProfitOrLoss)}</td><td>{row.result.profitMarginPercentage === null ? "N/A" : `${row.result.profitMarginPercentage.toFixed(2)}%`}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="report-footnote">Sensitivity analysis recalculates entered assumptions; it is not a prediction.</p>
    </section>
  );
}

function ReportMetric({ label, value, strong = false, negative = false }) {
  return (
    <div className={`report-metric${strong ? " strong" : ""}`}>
      <span>{label}</span>
      <strong className={negative ? "negative-value" : ""}>{value}</strong>
    </div>
  );
}
