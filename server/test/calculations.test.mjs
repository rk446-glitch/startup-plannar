import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import calculations from "../src/calculations.js";

const {
  ValidationError,
  calculateStartupInvestment,
  calculateMonthlyOperatingExpenses,
  calculateMonthlyFinancials,
  calculateBreakEven,
} = calculations;

const startupCosts = {
  equipment: 50000,
  furniture: 20000,
  renovation: 15000,
  registrationAndLicenses: 5000,
  initialInventory: 10000,
  shopDeposit: 20000,
  otherStartupCosts: 5000,
};

const monthlyFinancials = {
  sellingPricePerUnit: 100,
  variableCostPerUnit: 40,
  unitsSoldPerMonth: 1000,
  fixedMonthlyExpenses: 30000,
};

let server;
let baseUrl;
let authCookie;
const usersFile = join(tmpdir(), `foundry-calculations-${randomUUID()}.json`);

beforeAll(async () => {
  process.env.AUTH_USERS_FILE = usersFile;
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Calculation Test",
      email: "calculations@gmail.com",
      phone: "+14155551001",
      password: "test-password-123",
    }),
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "calculations@gmail.com", password: "test-password-123" }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Calculation API test setup login failed with HTTP ${loginResponse.status}.`);
  }
  authCookie = loginResponse.headers.get("set-cookie").split(";")[0];
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await rm(usersFile, { force: true });
});

function authenticatedFetch(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...options.headers, Cookie: authCookie },
  });
}

describe("financial calculations", () => {
  it("adds the one-time startup expenses", () => {
    expect(calculateStartupInvestment(startupCosts).totalInitialInvestment).toBe(125000);
  });

  it("handles zero and decimal one-time expenses and ignores unrelated fields", () => {
    const zeroCosts = Object.fromEntries(
      Object.keys(startupCosts).map((field) => [field, 0]),
    );
    expect(calculateStartupInvestment(zeroCosts).totalInitialInvestment).toBe(0);

    const decimalCosts = {
      ...zeroCosts,
      equipment: 10.25,
      otherStartupCosts: 0.5,
      monthlyRent: 9000,
    };
    expect(calculateStartupInvestment(decimalCosts).totalInitialInvestment).toBe(10.75);
  });

  it("rejects missing, non-number, null, negative, NaN, and infinite startup costs", () => {
    const invalidCosts = [
      ({ ...startupCosts, equipment: undefined }),
      ({ ...startupCosts, equipment: "50000" }),
      ({ ...startupCosts, equipment: null }),
      ({ ...startupCosts, equipment: -0.01 }),
      ({ ...startupCosts, equipment: NaN }),
      ({ ...startupCosts, equipment: Infinity }),
      ({ ...startupCosts, equipment: -Infinity }),
    ];

    const missingFurniture = { ...startupCosts };
    delete missingFurniture.furniture;
    expect(() => calculateStartupInvestment(missingFurniture)).toThrow(/"furniture" is required/);
    for (const costs of invalidCosts) {
      expect(() => calculateStartupInvestment(costs)).toThrow(ValidationError);
    }
  });

  it("rejects a startup total that overflows despite finite input amounts", () => {
    expect(() =>
      calculateStartupInvestment({
        ...startupCosts,
        equipment: Number.MAX_VALUE,
        furniture: Number.MAX_VALUE,
      }),
    ).toThrow(/total initial investment exceeds/i);
  });

  it("calculates monthly fixed and variable operating expenses separately", () => {
    const result = calculateMonthlyOperatingExpenses({
      monthlyRent: 10000,
      salaries: 12000,
      utilities: 3000,
      marketing: 2000,
      otherFixedMonthlyExpenses: 3000,
      variableCostPerUnit: 40,
      unitsSoldPerMonth: 1000,
    });

    expect(result.totalFixedMonthlyExpenses).toBe(30000);
    expect(result.totalVariableExpenses).toBe(40000);
    expect(result.totalMonthlyOperatingExpenses).toBe(70000);
  });

  it("validates all monthly expense fields and handles zero and decimal amounts", () => {
    const zeroExpenses = {
      monthlyRent: 0,
      salaries: 0,
      utilities: 0,
      marketing: 0,
      otherFixedMonthlyExpenses: 0,
      variableCostPerUnit: 0,
      unitsSoldPerMonth: 0,
    };
    expect(calculateMonthlyOperatingExpenses(zeroExpenses).totalMonthlyOperatingExpenses).toBe(0);
    expect(
      calculateMonthlyOperatingExpenses({
        ...zeroExpenses,
        monthlyRent: 10.25,
        variableCostPerUnit: 0.5,
        unitsSoldPerMonth: 3,
      }).totalMonthlyOperatingExpenses,
    ).toBe(11.75);

    for (const value of ["1", null, -1, NaN, Infinity]) {
      expect(() =>
        calculateMonthlyOperatingExpenses({ ...zeroExpenses, salaries: value }),
      ).toThrow(ValidationError);
    }
    expect(() =>
      calculateMonthlyOperatingExpenses({ ...zeroExpenses, unitsSoldPerMonth: 1.5 }),
    ).toThrow(/whole number/);
    const missingUtilities = { ...zeroExpenses };
    delete missingUtilities.utilities;
    expect(() => calculateMonthlyOperatingExpenses(missingUtilities)).toThrow(
      /"utilities" is required/,
    );
  });

  it("rejects monthly expense totals that overflow", () => {
    expect(() =>
      calculateMonthlyOperatingExpenses({
        monthlyRent: Number.MAX_VALUE,
        salaries: Number.MAX_VALUE,
        utilities: 0,
        marketing: 0,
        otherFixedMonthlyExpenses: 0,
        variableCostPerUnit: 0,
        unitsSoldPerMonth: 0,
      }),
    ).toThrow(/total fixed monthly expenses exceeds/i);
  });

  it("calculates revenue, operating expenses, profit, and margin", () => {
    const result = calculateMonthlyFinancials(monthlyFinancials);

    expect(result.monthlyRevenue).toBe(100000);
    expect(result.totalVariableExpenses).toBe(40000);
    expect(result.totalOperatingExpenses).toBe(70000);
    expect(result.monthlyOperatingProfitOrLoss).toBe(30000);
    expect(result.profitMarginPercentage).toBe(30);
  });

  it("returns a loss when expenses exceed revenue", () => {
    const result = calculateMonthlyFinancials({
      ...monthlyFinancials,
      fixedMonthlyExpenses: 80000,
    });

    expect(result.monthlyOperatingProfitOrLoss).toBe(-20000);
    expect(result.profitMarginPercentage).toBe(-20);
  });

  it("handles zero sales without dividing by zero", () => {
    const result = calculateMonthlyFinancials({
      ...monthlyFinancials,
      unitsSoldPerMonth: 0,
    });

    expect(result.monthlyRevenue).toBe(0);
    expect(result.totalVariableExpenses).toBe(0);
    expect(result.monthlyOperatingProfitOrLoss).toBe(-30000);
    expect(result.profitMarginPercentage).toBeNull();
  });

  it("handles zero revenue when the selling price is zero", () => {
    const result = calculateMonthlyFinancials({
      sellingPricePerUnit: 0,
      variableCostPerUnit: 0,
      unitsSoldPerMonth: 50,
      fixedMonthlyExpenses: 100,
    });

    expect(result.monthlyRevenue).toBe(0);
    expect(result.monthlyOperatingProfitOrLoss).toBe(-100);
    expect(result.profitMarginPercentage).toBeNull();
  });

  it("handles large finite financial values without losing valid results", () => {
    const result = calculateMonthlyFinancials({
      sellingPricePerUnit: 1e100,
      variableCostPerUnit: 2e99,
      unitsSoldPerMonth: 1000,
      fixedMonthlyExpenses: 3e101,
    });

    expect(result.monthlyRevenue).toBe(1e103);
    expect(result.totalVariableExpenses).toBe(2e102);
    expect(result.totalOperatingExpenses).toBe(2.3e102);
    expect(result.monthlyOperatingProfitOrLoss).toBe(7.7e102);
    expect(result.profitMarginPercentage).toBe(77);
  });

  it("rejects monthly calculations that overflow to non-finite results", () => {
    expect(() =>
      calculateMonthlyFinancials({
        sellingPricePerUnit: Number.MAX_VALUE,
        variableCostPerUnit: 0,
        unitsSoldPerMonth: 2,
        fixedMonthlyExpenses: 0,
      }),
    ).toThrow(/monthly revenue exceeds/i);
    expect(() =>
      calculateMonthlyFinancials({
        sellingPricePerUnit: 0,
        variableCostPerUnit: Number.MAX_VALUE,
        unitsSoldPerMonth: 2,
        fixedMonthlyExpenses: 0,
      }),
    ).toThrow(/total variable expenses exceeds/i);
    expect(() =>
      calculateMonthlyFinancials({
        sellingPricePerUnit: 1,
        variableCostPerUnit: Number.MAX_VALUE / 2,
        unitsSoldPerMonth: 2,
        fixedMonthlyExpenses: Number.MAX_VALUE / 2,
      }),
    ).toThrow(/total operating expenses exceeds/i);
    expect(() =>
      calculateMonthlyFinancials({
        sellingPricePerUnit: Number.MIN_VALUE,
        variableCostPerUnit: 0,
        unitsSoldPerMonth: 1,
        fixedMonthlyExpenses: Number.MAX_VALUE,
      }),
    ).toThrow(/profit margin exceeds/i);
  });

  it("rejects unsafe whole-number unit counts", () => {
    expect(() =>
      calculateMonthlyFinancials({ ...monthlyFinancials, unitsSoldPerMonth: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow(/safe whole number/);
  });

  it("rounds break-even units upward", () => {
    const result = calculateBreakEven({
      sellingPricePerUnit: 10,
      variableCostPerUnit: 3,
      fixedMonthlyExpenses: 15,
    });

    expect(result.breakEvenUnits).toBe(3);
    expect(result.breakEvenRevenue).toBe(30);
  });

  it("returns zero break-even units when fixed expenses are zero", () => {
    const result = calculateBreakEven({
      sellingPricePerUnit: 100,
      variableCostPerUnit: 40,
      fixedMonthlyExpenses: 0,
    });

    expect(result.breakEvenUnits).toBe(0);
    expect(result.breakEvenRevenue).toBe(0);
  });

  it("calculates the example break-even point and rounds fractional units upward", () => {
    const example = calculateBreakEven(monthlyFinancials);
    expect(example.contributionPerUnit).toBe(60);
    expect(example.breakEvenUnits).toBe(500);
    expect(example.breakEvenRevenue).toBe(50000);

    const fractional = calculateBreakEven({
      sellingPricePerUnit: 10,
      variableCostPerUnit: 3,
      fixedMonthlyExpenses: 15,
    });
    expect(fractional.breakEvenUnits).toBe(3);
    expect(fractional.breakEvenRevenue).toBe(30);
  });

  it("returns an explanation when zero selling price makes break-even impossible", () => {
    const result = calculateBreakEven({
      sellingPricePerUnit: 0,
      variableCostPerUnit: 0,
      fixedMonthlyExpenses: 100,
    });

    expect(result.canBreakEven).toBe(false);
    expect(result.contributionPerUnit).toBe(0);
    expect(result.breakEvenUnits).toBeNull();
    expect(result.breakEvenRevenue).toBeNull();
    expect(result.message).toMatch(/cannot be achieved/i);
  });

  it("rejects invalid break-even inputs and unrepresentable results", () => {
    for (const input of [
      { sellingPricePerUnit: undefined, variableCostPerUnit: 1, fixedMonthlyExpenses: 0 },
      { sellingPricePerUnit: "10", variableCostPerUnit: 1, fixedMonthlyExpenses: 0 },
      { sellingPricePerUnit: 10, variableCostPerUnit: null, fixedMonthlyExpenses: 0 },
      { sellingPricePerUnit: 10, variableCostPerUnit: -1, fixedMonthlyExpenses: 0 },
      { sellingPricePerUnit: NaN, variableCostPerUnit: 1, fixedMonthlyExpenses: 0 },
      { sellingPricePerUnit: Infinity, variableCostPerUnit: 1, fixedMonthlyExpenses: 0 },
    ]) {
      expect(() => calculateBreakEven(input)).toThrow(ValidationError);
    }

    expect(() =>
      calculateBreakEven({
        sellingPricePerUnit: 2,
        variableCostPerUnit: 1,
        fixedMonthlyExpenses: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow(/break-even unit count exceeds/i);
    expect(() =>
      calculateBreakEven({
        sellingPricePerUnit: Number.MAX_VALUE,
        variableCostPerUnit: Number.MAX_VALUE / 4,
        fixedMonthlyExpenses: Number.MAX_VALUE,
      }),
    ).toThrow(/break-even revenue exceeds/i);
  });

  it("explains when break-even is not achievable with zero or negative contribution", () => {
    for (const variableCostPerUnit of [100, 120]) {
      const result = calculateBreakEven({
        sellingPricePerUnit: 100,
        variableCostPerUnit,
        fixedMonthlyExpenses: 30000,
      });

      expect(result.canBreakEven).toBe(false);
      expect(result.breakEvenUnits).toBeNull();
      expect(result.message).toMatch(/cannot be achieved/i);
    }
  });

  it("supports decimal selling prices and costs", () => {
    const result = calculateMonthlyFinancials({
      sellingPricePerUnit: 10.5,
      variableCostPerUnit: 2.25,
      unitsSoldPerMonth: 4,
      fixedMonthlyExpenses: 10,
    });

    expect(result.monthlyRevenue).toBe(42);
    expect(result.totalVariableExpenses).toBe(9);
    expect(result.monthlyOperatingProfitOrLoss).toBe(23);
    expect(result.profitMarginPercentage).toBe((23 / 42) * 100);
  });

  it("rejects missing, negative, non-finite, and fractional unit inputs", () => {
    expect(
      () => calculateStartupInvestment({ ...startupCosts, equipment: undefined }),
    ).toThrow(ValidationError);
    expect(
      () => calculateStartupInvestment({ ...startupCosts, equipment: -1 }),
    ).toThrow(ValidationError);
    expect(
      () => calculateBreakEven({
        sellingPricePerUnit: Infinity,
        variableCostPerUnit: 1,
        fixedMonthlyExpenses: 0,
      }),
    ).toThrow(ValidationError);
    expect(
      () => calculateMonthlyFinancials({ ...monthlyFinancials, unitsSoldPerMonth: 2.5 }),
    ).toThrow(ValidationError);
  });
});

describe("calculation API", () => {
  it("retains the API health-check endpoint", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("returns calculation results using the shared success response shape", async () => {
    const response = await authenticatedFetch("/api/calculate/startup-cost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(startupCosts),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totalInitialInvestment).toBe(125000);
  });

  it("returns the expected monthly financials through the API", async () => {
    const response = await authenticatedFetch("/api/calculate/monthly-financials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(monthlyFinancials),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.monthlyRevenue).toBe(100000);
    expect(body.data.totalOperatingExpenses).toBe(70000);
    expect(body.data.monthlyOperatingProfitOrLoss).toBe(30000);
    expect(body.data.profitMarginPercentage).toBe(30);
  });

  it("accepts itemized fixed monthly expenses and totals them on the backend", async () => {
    const response = await authenticatedFetch("/api/calculate/monthly-financials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellingPricePerUnit: 100,
        unitsSoldPerMonth: 1000,
        variableCostPerUnit: 40,
        monthlyRent: 10000,
        salaries: 12000,
        utilities: 3000,
        marketing: 2000,
        otherFixedMonthlyExpenses: 3000,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.fixedMonthlyExpenses).toBe(30000);
    expect(body.data.monthlyRevenue).toBe(100000);
    expect(body.data.totalOperatingExpenses).toBe(70000);
    expect(body.data.monthlyOperatingProfitOrLoss).toBe(30000);
  });

  it("returns a clear 400 response for missing, negative, and invalid JSON inputs", async () => {
    const cases = [
      { body: JSON.stringify({}) },
      { body: JSON.stringify({ ...monthlyFinancials, sellingPricePerUnit: -1 }) },
      { body: "{invalid json" },
    ];

    for (const testCase of cases) {
      const response = await authenticatedFetch("/api/calculate/monthly-financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: testCase.body,
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe("string");
      expect(body.error).not.toMatch(/stack| at .*:\d+:\d+/i);
    }
  });

  it("returns a valid break-even response when contribution is not positive", async () => {
    const response = await authenticatedFetch("/api/calculate/break-even", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellingPricePerUnit: 100,
        variableCostPerUnit: 100,
        fixedMonthlyExpenses: 30000,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.canBreakEven).toBe(false);
    expect(body.data.breakEvenUnits).toBeNull();
  });

  it("returns the expected normal break-even result through the API", async () => {
    const response = await authenticatedFetch("/api/calculate/break-even", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(monthlyFinancials),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.contributionPerUnit).toBe(60);
    expect(body.data.breakEvenUnits).toBe(500);
    expect(body.data.breakEvenRevenue).toBe(50000);
  });

  it.each([
    ["/api/calculate/startup-cost", startupCosts, { ...startupCosts, equipment: -1 }],
    [
      "/api/calculate/monthly-financials",
      monthlyFinancials,
      { ...monthlyFinancials, unitsSoldPerMonth: 1.5 },
    ],
    [
      "/api/calculate/break-even",
      { sellingPricePerUnit: 100, variableCostPerUnit: 40, fixedMonthlyExpenses: 30000 },
      { sellingPricePerUnit: 100, variableCostPerUnit: null, fixedMonthlyExpenses: 30000 },
    ],
  ])(
    "returns JSON 400 responses for invalid bodies to %s",
    async (path, validInput, invalidInput) => {
      for (const bodyValue of [invalidInput, {}, null, []]) {
        const response = await authenticatedFetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyValue),
        });
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.success).toBe(false);
        expect(typeof body.error).toBe("string");
        expect(body.error.length).toBeGreaterThan(0);
      }

      const successResponse = await authenticatedFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validInput),
      });
      expect(successResponse.status).toBe(200);
    },
  );

  it("returns a clear JSON 400 for an overflowing API calculation", async () => {
    const response = await authenticatedFetch("/api/calculate/monthly-financials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellingPricePerUnit: Number.MAX_VALUE,
        variableCostPerUnit: 0,
        unitsSoldPerMonth: 2,
        fixedMonthlyExpenses: 0,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/monthly revenue exceeds/i);
  });
});
