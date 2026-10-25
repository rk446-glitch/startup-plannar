# User Manual

## Startup Cost and Profitability Analysis System

Foundry Startup Planner is a local planning tool for college project demonstrations. It calculates financial results from the values you enter; it does not predict business performance.

## Start the application

Install dependencies once:

```powershell
cd client
npm install
cd ../server
npm install
```

Open two terminals from the project folder.

Backend terminal:

```powershell
cd server
npm start
```

Frontend terminal:

```powershell
cd client
npm run dev
```

Open the Vite URL shown in the frontend terminal. The backend uses port 5000 by default, and the Vite development proxy forwards `/api` requests to it.

If port 5000 is occupied, run the backend with `$env:PORT=5001` and `npm start`, then run the frontend with `$env:VITE_API_TARGET="http://localhost:5001"` and `npm run dev`.

## Register, log in, and log out

1. Open **Register** from the public login page and enter your name, Gmail address, international phone number (for example `+14155552671`), and a password of 8–128 characters.
2. After the success message, enter the same credentials on **Login**. No email verification or phone OTP is required.
3. The authenticated session opens the Dashboard and allows access to every planner feature.
4. Use **Log out** in the top bar to invalidate the session. Protected calculation APIs require a valid login.

Passwords are stored as salted scrypt hashes, not in browser storage. In local development, accounts use an ignored JSON file and sessions are in memory; restarting the backend requires a new login. Production accounts and hashed session tokens use PostgreSQL and survive backend restarts.

## Calculate startup costs

1. Choose **Startup Costs**.
2. Enter the one-time amounts for equipment, furniture, renovation, registration and licenses, initial inventory, shop deposit, and other startup costs.
3. Select **Calculate Startup Investment**.
4. The result panel shows the total initial investment returned by the API.

These costs are one-time costs, not monthly expenses.

## Calculate monthly profit and loss

1. Choose **Profit & Loss**.
2. Enter selling price, whole units sold per month, variable cost per unit, rent, salaries, utilities, marketing, and other fixed monthly expenses.
3. Select **Calculate Monthly Profit & Loss**.
4. Review revenue, variable and total operating expenses, operating profit or loss, margin, and charts.

Startup investment is not counted as a recurring monthly expense. If revenue is zero, the margin is shown as unavailable.

## Calculate break-even

1. Choose **Break-Even Analysis**.
2. Enter selling price per unit, variable cost per unit, and fixed monthly expenses.
3. Select **Calculate Break-Even**.
4. Review contribution per unit, break-even units, and break-even revenue. If contribution is zero or negative, the app explains why a break-even target cannot be reached through additional sales.

## Scenario analysis

Open **Scenario Analysis** and edit the assumptions in Best case, Expected case, and Worst case. The initial assumptions are illustrative and editable, not predictions. **Calculate all scenarios** sends each set to the calculation API and displays the results and comparison chart.

## Sensitivity analysis

Open **Sensitivity Analysis**, edit the baseline values, choose one input to vary, and select **Calculate sensitivity**. The app calculates -20%, -10%, baseline, +10%, and +20% variations through the API. Unit counts are rounded to whole values. A value outside the supported numeric range is rejected instead of producing a misleading result.

## Reports and downloads

Complete at least one successful calculator or analysis, then open **Reports**. The summary and downloads use actual current form inputs and successfully returned API results. CSV files include UTF-8 encoding with a BOM for spreadsheet compatibility. PDF reports contain readable summary sections, dated line-item results, formulas, and assumptions.

The reports are generated in the browser. No report is uploaded to or stored on the server. Amounts use illustrative currency units because this version does not include a currency selector.

## Save, load, rename, and delete plans

On **Reports**, enter a business or plan name and a saved-plan name, then select **Save current plan**. Saved plans include input values and scenario/sensitivity assumptions. Choose **Load** to restore values and recalculate available results through the API. Use **Rename** to change a saved name or **Delete** to remove a plan after confirmation.

Saved plans exist only in this browser's local storage on this device and are separated by authenticated user. They are not synchronized to other devices and may be lost when browser storage is cleared. If storage is unavailable or full, the page shows an error.

## Production deployment

Production uses Vercel for the `client` directory and its same-origin `/api/*` proxy function, Render for the Express API, and Render PostgreSQL for persistent accounts and sessions. See the README's **Production architecture and deployment** section for exact root directories, commands, environment variables, existing-account migration, and manual account authorization steps.

## API routes

- `GET /api` — API name and status.
- `GET /api/health` — health check.
- `POST /api/auth/register` — create an account with a Gmail address and international phone number.
- `POST /api/auth/login` — start an authenticated session.
- `GET /api/auth/me` — check the current session.
- `POST /api/auth/logout` — invalidate the current session.
- `POST /api/calculate/startup-cost` — total one-time investment.
- `POST /api/calculate/monthly-financials` — monthly revenue, expenses, profit/loss, and margin.
- `POST /api/calculate/break-even` — contribution and break-even information.

All amounts must be finite non-negative numbers; unit counts must be non-negative whole numbers. See the README for request examples and test commands.

## Formulas and limitations

- Initial investment = sum of one-time startup costs.
- Revenue = selling price per unit × units sold.
- Variable expense = variable cost per unit × units sold.
- Operating expenses = fixed monthly expenses + variable expenses.
- Operating profit/loss = revenue − operating expenses.
- Margin = operating profit/loss ÷ revenue × 100, only when revenue is positive.
- Contribution per unit = selling price − variable cost.
- Break-even units = ceiling(fixed monthly expenses ÷ contribution), only when contribution is positive.
- Break-even revenue = break-even units × selling price.

The project does not calculate cash flow, return on investment, taxes, depreciation, financing, or predicted outcomes. Production account and session storage uses PostgreSQL; local development can use the ignored JSON account file. Deployment configuration is documented in the README.
