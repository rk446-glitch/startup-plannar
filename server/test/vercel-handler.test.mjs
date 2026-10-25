import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const indexHandler = require("../../api/index.js");
const app = require("../../api/[...path].js");
const { createSession, revokeSession } = require("../src/auth/session");
const originalVercel = process.env.VERCEL;
const originalDatabaseUrl = process.env.DATABASE_URL;
let server;
let baseUrl;

beforeAll(async () => {
  delete process.env.VERCEL;
  delete process.env.DATABASE_URL;
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("Vercel Express function entry point", () => {
  it("routes existing API endpoints through the exported Express application", async () => {
    const [apiResponse, healthResponse, missingResponse] = await Promise.all([
      fetch(`${baseUrl}/api`),
      fetch(`${baseUrl}/api/health`),
      fetch(`${baseUrl}/api/missing`),
    ]);

    expect(apiResponse.status).toBe(200);
    expect(await apiResponse.json()).toMatchObject({
      name: "Startup Cost and Profitability Analysis System",
    });
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toMatchObject({ status: "ok" });
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toMatchObject({ error: "Route not found" });
  });

  it("exports the API root through the Vercel function entry point", async () => {
    expect(indexHandler).toBe(app);
    const response = await fetch(`${baseUrl}/api`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: "Startup Cost and Profitability Analysis System",
    });
  });

  it("requires persistent PostgreSQL storage when running on Vercel", async () => {
    process.env.VERCEL = "1";
    delete process.env.DATABASE_URL;

    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      error: "Production database is not configured.",
    });
  });

  it("marks Vercel session cookies Secure", async () => {
    process.env.VERCEL = "1";
    delete process.env.DATABASE_URL;
    const response = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
    };

    await createSession(response, "vercel-cookie-test");

    expect(response.headers["Set-Cookie"]).toMatch(/; Secure/);
    await revokeSession({ headers: { cookie: response.headers["Set-Cookie"].split(";")[0] } });
  });
});
