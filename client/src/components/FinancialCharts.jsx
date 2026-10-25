import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
);

const palette = {
  green: "#347b61",
  greenLight: "#93bca7",
  amber: "#c5a05a",
  red: "#bd6259",
  blue: "#7585aa",
};

const amount = (value) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${amount(context.parsed.y)}`,
      },
    },
  },
};

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="chart-card">
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function MonthlyOverviewChart({ result }) {
  const data = {
    labels: ["Monthly"],
    datasets: [
      {
        label: "Revenue",
        data: [result.monthlyRevenue],
        backgroundColor: palette.green,
        borderRadius: 5,
      },
      {
        label: "Operating expenses",
        data: [result.totalOperatingExpenses],
        backgroundColor: palette.amber,
        borderRadius: 5,
      },
      {
        label: "Profit / loss",
        data: [result.monthlyOperatingProfitOrLoss],
        backgroundColor: result.monthlyOperatingProfitOrLoss < 0 ? palette.red : palette.blue,
        borderRadius: 5,
      },
    ],
  };

  return (
    <ChartCard title="Monthly financial overview" subtitle="Values returned by the backend calculation">
      <div className="chart-canvas">
        <Bar data={data} options={{ ...commonOptions, scales: { y: { beginAtZero: true, title: { display: true, text: "Illustrative currency units" } } } }} />
      </div>
    </ChartCard>
  );
}

export function RevenueCostChart({ curve }) {
  const marker = curve.breakEven.canBreakEven
    ? [{ x: curve.breakEven.breakEvenUnits, y: curve.breakEven.breakEvenRevenue }]
    : [];
  const data = {
    datasets: [
      {
        label: "Revenue",
        data: curve.points.map((point) => ({ x: point.unitsSoldPerMonth, y: point.monthlyRevenue })),
        borderColor: palette.green,
        backgroundColor: palette.greenLight,
        tension: 0.25,
      },
      {
        label: "Total operating cost",
        data: curve.points.map((point) => ({ x: point.unitsSoldPerMonth, y: point.totalOperatingExpenses })),
        borderColor: palette.amber,
        backgroundColor: palette.amber,
        tension: 0.25,
      },
      {
        type: "scatter",
        label: "Break-even point",
        data: marker,
        backgroundColor: palette.red,
        borderColor: palette.red,
        pointRadius: 6,
      },
    ],
  };
  const options = {
    ...commonOptions,
    scales: {
      x: { type: "linear", title: { display: true, text: "Units sold per month" } },
      y: { beginAtZero: true, title: { display: true, text: "Illustrative currency units" } },
    },
    plugins: {
      ...commonOptions.plugins,
      tooltip: {
        callbacks: {
          label: (context) =>
            context.dataset.label === "Break-even point"
              ? `Break-even: ${amount(context.parsed.x)} units / ${amount(context.parsed.y)}`
              : `${context.dataset.label}: ${amount(context.parsed.y)}`,
        },
      },
    },
  };

  return (
    <ChartCard title="Revenue vs. total operating cost" subtitle="The backend calculates each plotted sales quantity">
      <div className="chart-canvas">
        <Line data={data} options={options} />
      </div>
      <p className="chart-note">
        {curve.breakEven.canBreakEven
          ? `Break-even occurs at ${amount(curve.breakEven.breakEvenUnits)} units.`
          : curve.breakEven.message}
      </p>
    </ChartCard>
  );
}

export function CostBreakdownChart({ result }) {
  const data = {
    labels: ["Fixed monthly expenses", "Variable expenses"],
    datasets: [
      {
        data: [result.fixedMonthlyExpenses, result.totalVariableExpenses],
        backgroundColor: [palette.blue, palette.amber],
        borderColor: "#fff",
        borderWidth: 3,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${amount(context.parsed)}`,
        },
      },
    },
  };

  return (
    <ChartCard title="Monthly cost breakdown" subtitle="Fixed and variable costs are reported by the backend">
      <div className="chart-canvas doughnut-canvas">
        <Bar
          data={data}
          options={{
            ...options,
            indexAxis: "y",
            scales: { x: { beginAtZero: true, title: { display: true, text: "Illustrative currency units" } } },
          }}
        />
      </div>
      <div className="chart-values">
        <span>Fixed: {amount(result.fixedMonthlyExpenses)}</span>
        <span>Variable: {amount(result.totalVariableExpenses)}</span>
      </div>
    </ChartCard>
  );
}

export function ComparisonChart({ rows }) {
  const data = {
    labels: rows.map((row) => row.label),
    datasets: [
      { label: "Revenue", data: rows.map((row) => row.result.monthlyRevenue), backgroundColor: palette.green, borderRadius: 4 },
      { label: "Operating expenses", data: rows.map((row) => row.result.totalOperatingExpenses), backgroundColor: palette.amber, borderRadius: 4 },
      {
        label: "Profit / loss",
        data: rows.map((row) => row.result.monthlyOperatingProfitOrLoss),
        backgroundColor: rows.map((row) => row.result.monthlyOperatingProfitOrLoss < 0 ? palette.red : palette.blue),
        borderRadius: 4,
      },
    ],
  };
  return (
    <ChartCard title="Scenario comparison" subtitle="Results calculated by the project API for your editable assumptions">
      <div className="chart-canvas">
        <Bar data={data} options={{ ...commonOptions, scales: { y: { title: { display: true, text: "Illustrative currency units" } } } }} />
      </div>
    </ChartCard>
  );
}

export function SensitivityChart({ rows, valueLabel }) {
  const data = {
    labels: rows.map((row) => row.changeLabel),
    datasets: [
      {
        label: "Operating profit / loss",
        data: rows.map((row) => row.result.monthlyOperatingProfitOrLoss),
        backgroundColor: rows.map((row) => row.result.monthlyOperatingProfitOrLoss < 0 ? palette.red : palette.green),
        borderRadius: 4,
      },
    ],
  };
  return (
    <ChartCard title="Sensitivity of operating profit / loss" subtitle={`Results as ${valueLabel.toLowerCase()} changes`}>
      <div className="chart-canvas">
        <Bar data={data} options={{ ...commonOptions, scales: { y: { title: { display: true, text: "Illustrative currency units" } } } }} />
      </div>
    </ChartCard>
  );
}
