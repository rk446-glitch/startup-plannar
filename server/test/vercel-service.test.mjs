import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { createSession, revokeSession } from "../src/auth/session.js";

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

describe("Express API service on Vercel", () => {
  it("serves the existing API routes and JSON 404 response", async () => {
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

  it("requires persistent PostgreSQL storage on Vercel", async () => {
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
