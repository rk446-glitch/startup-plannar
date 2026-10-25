import { useEffect, useRef, useState } from "react";
import { calculateMonthlyCurve } from "../services/api.js";
import {
  CostBreakdownChart,
  MonthlyOverviewChart,
  RevenueCostChart,
} from "./FinancialCharts.jsx";

export default function MonthlyCharts({ result, onBreakEvenCalculated }) {
  const [curve, setCurve] = useState(null);
  const [error, setError] = useState("");
  const onBreakEvenCalculatedRef = useRef(onBreakEvenCalculated);
  onBreakEvenCalculatedRef.current = onBreakEvenCalculated;

  useEffect(() => {
    let current = true;
    setCurve(null);
    setError("");

    calculateMonthlyCurve({
      sellingPricePerUnit: result.sellingPricePerUnit,
      unitsSoldPerMonth: result.unitsSoldPerMonth,
      variableCostPerUnit: result.variableCostPerUnit,
      fixedMonthlyExpenses: result.fixedMonthlyExpenses,
    })
      .then((value) => {
        if (current) {
          setCurve(value);
          onBreakEvenCalculatedRef.current?.(value.breakEven);
        }
      })
      .catch((requestError) => {
        if (current) setError(requestError.message);
      });

    return () => {
      current = false;
    };
  }, [result]);

  return (
    <div className="financial-charts">
      <p className="currency-note">All amounts are illustrative currency units.</p>
      <MonthlyOverviewChart result={result} />
      <CostBreakdownChart result={result} />
      {error ? (
        <p className="form-error" role="alert">Chart data could not be loaded: {error}</p>
      ) : curve ? (
        <RevenueCostChart curve={curve} />
      ) : (
        <div className="chart-loading" role="status">Loading sales curve from the API…</div>
      )}
    </div>
  );
}
