# Startup Cost and Profitability Analysis System

A college mini-project for estimating a startup's one-time investment, monthly operating results, and break-even point. The app also provides interactive charts, deterministic scenario and sensitivity analysis, browser-only saved plans, and downloadable reports.

## Requirements

- Node.js and npm

## Accounts and sessions

The application has public **Login** and **Register** screens. Registration requires a name, Gmail address, international-format phone number, and password (8–128 characters); there is no email verification or phone OTP. Passwords are salted scrypt hashes. For local development, accounts are saved in the ignored `server/data/users.json` file and sessions are in memory. Production uses PostgreSQL for both accounts and hashed session tokens, so sessions survive backend restarts. The browser receives only an HttpOnly, SameSite=Strict cookie; it does not store passwords or session IDs.

Calculation endpoints require a valid session and return HTTP 401 otherwise. Browser-saved plans remain in localStorage, namespaced by authenticated user ID. They are not synchronized or stored on the server.

## Production architecture and deployment

- **Frontend and same-origin API proxy:** Vercel project root `client`, build command `npm run build`, output `dist`. The Node function in `client/api/[...path].js` forwards `/api/*` requests to the backend while keeping the session cookie same-origin with the Vercel app.
- **Express backend:** Render web service declared in `render.yaml`, root `server`, build `npm ci`, start `npm start`, health check `/api/health`.
- **Persistent database:** Render PostgreSQL, linked to the backend using its internal connection string. The backend creates its tables idempotently at startup. Render's database resource is a paid `basic-256mb` plan in this blueprint; check current pricing before creating it.

After pushing to GitHub, import the repository in Vercel and set the project root to `client`. Create the Render resources from the root `render.yaml` blueprint. Vercel needs the server-side environment variable `BACKEND_ORIGIN` set to the actual Render service origin (for example, the service URL Render assigns, without a path). Render needs `CLIENT_ORIGIN` set to the exact Vercel deployment origin. Deploy the Render service with a temporary valid HTTPS origin if its initial Blueprint prompt happens before the Vercel URL exists, then replace it with the actual Vercel origin and redeploy.

Before migrating existing local accounts, configure the Render database's **external** connection URL and TLS for a one-time local migration. In PowerShell, from `server`, set `$env:DATABASE_URL` to the external URL and `$env:DATABASE_SSL="true"`, then run `npm run migrate:users`. The script copies the ignored local `data/users.json` accounts in one transaction and does not print account details; it leaves the local file untouched. Existing accounts without a phone keep a null phone value. Never commit the user file or database URL.

Environment variable names and placeholders are in the root `.env.example` and `client/.env.example`. `BACKEND_ORIGIN` is server-side only; do not rename it to a `VITE_` variable. Render requires `DATABASE_URL`, `NODE_ENV=production`, and the exact `CLIENT_ORIGIN`; `DATABASE_SSL=true` is only needed for a TLS-required external database connection. Vercel and Render account authorization, creation of the paid database/service, environment variable entry, and final deploy approval require the project owner's account access.

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

The Vercel API proxy has dependency-free Node tests in the client:

```powershell
cd client
npm run test:proxy
```

## Run the frontend

In a second terminal, from the project folder:

```powershell
cd client
npm run dev
```

Open the local URL printed by Vite. Requests from the frontend to `/api` are forwarded to `http://localhost:5000` during development, so start the backend in its own terminal as well.

## Build the frontend

From the `client` folder, run:

```powershell
npm run build
```
