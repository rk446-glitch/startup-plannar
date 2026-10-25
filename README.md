# Startup Cost and Profitability Analysis System

A college mini-project for estimating a startup's one-time investment, monthly operating results, and break-even point. The app also provides interactive charts, deterministic scenario and sensitivity analysis, browser-only saved plans, and downloadable reports.

## Requirements

- Node.js and npm

## Accounts and sessions

The application has public **Login** and **Register** screens. Registration requires a name, Gmail address, international-format phone number, and password (8–128 characters); there is no email verification or phone OTP. Passwords are salted scrypt hashes. For local development, accounts are saved in the ignored `server/data/users.json` file and sessions are in memory. Production uses PostgreSQL for both accounts and hashed session tokens, so sessions survive backend restarts. The browser receives only an HttpOnly, SameSite=Strict cookie; it does not store passwords or session IDs.

Calculation endpoints require a valid session and return HTTP 401 otherwise. Browser-saved plans remain in localStorage, namespaced by authenticated user ID. They are not synchronized or stored on the server.

## Production architecture and deployment

The complete application is deployed from **one Vercel project** rooted at the repository root:

- Vite builds the React frontend from `client/` into `client/dist/`.
- Vercel builds the existing Express application in `server/` as a serverless service. Top-level rewrites route `/api` and `/api/*` to that service and all other paths to the Vite frontend service. Both services use the existing API handlers and calculation functions; no separate backend host is required.
- PostgreSQL stores account records and hashed, revocable session tokens. Vercel's function filesystem is not used for persistent data. Create a managed PostgreSQL database (for example, through a Vercel Marketplace PostgreSQL integration) and configure `DATABASE_URL`.
- Saved business plans remain browser-local in localStorage, namespaced and validated by authenticated user ID. They persist across deployments in that browser but are not stored in PostgreSQL, shared across devices, or recoverable if browser storage is cleared.

### Connect GitHub and configure Vercel

1. In Vercel, choose **Add New → Project**, import `rk446-glitch/startup-plannar`, and set the **Root Directory** to `.` (the repository root).
2. Keep the project root at the repository root (`.`) and use the **Services** configuration in `vercel.json`. It builds the Vite frontend and Express API from their existing directories, with one domain and one Vercel project.
3. Add a managed PostgreSQL integration/database and add its connection URL to the Vercel project's **Environment Variables** as `DATABASE_URL` for Production (and Preview only if each preview has an intentionally configured database).
4. Set `DATABASE_SSL=true` only if the provider's connection requires TLS and its connection string does not already configure it. `CLIENT_ORIGIN` is optional for the default same-origin deployment; the API validates browser mutations against the HTTPS request host. If set, use the exact app origin, such as `https://your-project.vercel.app`.
5. Deploy (or redeploy after connecting the database). Vercel environment changes apply to new deployments, not deployments already built. The first API request initializes the existing `users` and `sessions` schema idempotently. Check `/api/health`; it reports an unavailable database as HTTP 503 rather than claiming the service is ready.

Vercel supplies `VERCEL=1` at runtime. Do not set a separate backend URL or a `VITE_*` production API URL. Frontend requests use relative `/api/...` paths, so the website and API share the same domain and HttpOnly session cookie. Vercel's `NODE_ENV` production setting enables secure cookies.

### Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Managed PostgreSQL connection string; server-side only. |
| `DATABASE_SSL` | Provider-dependent | Set to `true` only when TLS is required but not configured by the URL. |
| `CLIENT_ORIGIN` | No | Optional extra allowed browser origin; same-origin Vercel traffic is checked against the request host. |

`VERCEL` and `NODE_ENV` are provided by the platform. `AUTH_USERS_FILE` is only for local migration and must not point to a file on Vercel. Do not add database credentials to source control or frontend-prefixed environment variables.

### Migrate existing local accounts

If the ignored `server/data/users.json` contains accounts to preserve, migrate them once after creating the database. In PowerShell, from `server`, supply the database connection string securely in the current terminal and run:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE"
$env:DATABASE_SSL = "true" # Only if the database requires TLS.
npm run migrate:users
```

The script initializes the schema, imports accounts in a transaction without printing account details, leaves the source file untouched, and skips matching user IDs. Do not commit the connection string or local user file. The database connection and account migration must be verified by the project owner after supplying valid provider credentials.

### Troubleshooting

- **`Production database is not configured` / HTTP 503:** add `DATABASE_URL` to the Vercel environment for the deployment and redeploy.
- **`Production database is unavailable` / health check HTTP 503:** verify the provider URL, database network access, and whether `DATABASE_SSL=true` is required.
- **API routes return 404:** confirm the project root is the repository root and the `server` service plus `/api` rewrites in `vercel.json` are deployed.
- **Registration/login fails after deployment:** first confirm `/api/health` is ready; then inspect Vercel Function logs for database connectivity errors. Existing local accounts are not present in the new database until migrated.
- **Browser reports a blocked origin:** use the same deployed origin for the website and API, and remove stale cross-origin API URLs. If a separately hosted frontend is intentionally used, set `CLIENT_ORIGIN` to its exact HTTPS origin.
- **Build cannot find a package:** keep the repository-root install command from `vercel.json`; it installs the backend and frontend lockfiles without adding a root dependency manifest.

## Install dependencies

Open a terminal in the project folder and install each part separately:

```powershell
cd client
npm install
cd ../server
npm install
```

## Run the backend

In a terminal, from the project folder:

```powershell
cd server
npm start
```

The API listens on `http://localhost:5000` by default. Set the `PORT` environment variable to use a different port.
If port 5000 is already in use, set `$env:PORT=5001` before `npm start`; set `$env:VITE_API_TARGET="http://localhost:5001"` before `npm run dev`.

- `GET http://localhost:5000/api` returns the project name and API status.
- `GET http://localhost:5000/api/health` confirms the server is running.

## Authentication API

- `POST /api/auth/register` — register with `{ "name": "Example User", "email": "user@gmail.com", "phone": "+14155552671", "password": "at-least-8-characters" }`. Returns a success message; then log in.
- `POST /api/auth/login` — creates an HttpOnly session cookie.
- `GET /api/auth/me` — returns the current session user or HTTP 401.
- `POST /api/auth/logout` — invalidates the current session and clears its cookie.

## Calculation API

All calculation endpoints require an authenticated session. They accept a JSON object and return `{ "success": true, "data": ... }` when valid. Invalid input returns HTTP 400 with `{ "success": false, "error": "..." }`; an unauthenticated request returns HTTP 401. Every amount is required and must be a finite, non-negative number. Unit counts must be whole numbers.

### `POST /api/calculate/startup-cost`

Adds one-time startup expenses. These costs are not included in monthly operating expenses.

```json
{
  "equipment": 50000,
  "furniture": 20000,
  "renovation": 15000,
  "registrationAndLicenses": 5000,
  "initialInventory": 10000,
  "shopDeposit": 20000,
  "otherStartupCosts": 5000
}
```

### `POST /api/calculate/monthly-financials`

Calculates revenue, variable and total operating expenses, monthly profit or loss, and profit margin. The margin is `null` when revenue is zero.

```json
{
  "sellingPricePerUnit": 100,
  "variableCostPerUnit": 40,
  "unitsSoldPerMonth": 1000,
  "fixedMonthlyExpenses": 30000
}
```

### `POST /api/calculate/break-even`

Calculates contribution per unit and the break-even units and revenue. When contribution is zero or negative, the response explains that break-even cannot be achieved through additional unit sales and returns `null` for units and revenue.

```json
{
  "sellingPricePerUnit": 100,
  "variableCostPerUnit": 40,
  "fixedMonthlyExpenses": 30000
}
```

The reusable monthly expense function also accepts `monthlyRent`, `salaries`, `utilities`, `marketing`, `otherFixedMonthlyExpenses`, `variableCostPerUnit`, and `unitsSoldPerMonth`.

## Charts and what-if analysis

After a successful monthly profit and loss calculation, the frontend displays:

- A monthly revenue, operating expenses, and profit/loss overview.
- A revenue-versus-total-operating-cost curve with a backend-calculated break-even marker when available.
- A fixed-versus-variable monthly cost breakdown.

Scenario Analysis submits each editable best, expected, and worst case assumption set to the monthly financials and break-even API endpoints. Sensitivity Analysis submits five variations (-20%, -10%, baseline, +10%, +20%) for one selected assumption. All what-if amounts are illustrative user assumptions, not predictions. Calculated results are not stored in saved plans; loading a plan recalculates them through the API.

The charts use Chart.js and `react-chartjs-2`; their dependencies are included in the client package.

## Reports and saved plans

Navigate to **Reports** after completing at least one calculator or analysis. The report uses the latest successful API results and current inputs. Choose **Download CSV Report** or **Download Financial Report (PDF)** to create a local file in the browser. Amounts are shown as illustrative currency units because this version does not have a currency selector.

Use **Save current plan** to store the current input values and scenario/sensitivity assumptions in this browser's `localStorage`. From the saved plan list, you can load, rename, or delete plans. Loading restores inputs and re-runs available calculations through the backend. Plans are not sent to a server and may be lost when browser data is cleared. They are not shared between browsers or devices.

## Calculation formulas and assumptions

- Initial investment is the sum of the seven one-time startup expense inputs.
- Monthly revenue = selling price per unit × units sold.
- Variable expenses = variable cost per unit × units sold.
- Total operating expenses = fixed monthly expenses + variable expenses.
- Monthly operating profit or loss = revenue − total operating expenses.
- Profit margin = operating profit or loss ÷ revenue × 100; it is not reported when revenue is zero.
- Contribution per unit = selling price − variable cost.
- When contribution is positive, break-even units = ceiling(fixed monthly expenses ÷ contribution), and break-even revenue = break-even units × selling price.
- When contribution is zero or negative, break-even through additional sales is not achievable at those assumptions.

Calculations use non-negative numeric inputs and whole-number unit counts. Scenario and sensitivity outputs are deterministic results for user-provided assumptions; they are not predictions. Monthly operating profit is not a cash-flow or return-on-investment calculation.

## Project objectives and limitations

The project demonstrates a React/Vite frontend connected to a Node/Express calculation API. Production account/session data uses PostgreSQL; saved financial plans and report generation remain browser-local. The project has no currency selection or forecasting.

For user instructions and the main interaction flow, see [USER-MANUAL.md](./USER-MANUAL.md).

## Run backend tests

From the `server` folder, run:

```powershell
npm test
```

## Run the frontend

In a second terminal, from the project folder:

```powershell
cd client
npm run dev
```

Open the local URL printed by Vite. During local development, requests to `/api` are forwarded to `http://localhost:5000`, so start the backend in its own terminal as well.

## Build the frontend

From the `client` folder, run:

```powershell
npm run build
```
