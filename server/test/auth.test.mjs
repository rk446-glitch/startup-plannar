import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, rm } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";

let server;
let baseUrl;
const usersFile = join(tmpdir(), `foundry-auth-${randomUUID()}.json`);

beforeAll(async () => {
  process.env.AUTH_USERS_FILE = usersFile;
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await rm(usersFile, { force: true });
});

function post(path, body, cookie) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function sessionCookie(response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("cookie session authentication", () => {
  it("registers without verification and rejects malformed credentials", async () => {
    const invalid = await post("/api/auth/register", {
      name: "Tester",
      email: "not-an-email",
      phone: "+14155550001",
      password: "short",
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).success).toBe(false);
    const nonGmail = await post("/api/auth/register", {
      name: "Tester",
      email: "tester@example.com",
      phone: "+14155550003",
      password: "secure-password-3",
    });
    expect(nonGmail.status).toBe(400);
    const malformedPhone = await post("/api/auth/register", {
      name: "Tester",
      email: "tester@gmail.com",
      phone: "4155550003",
      password: "secure-password-3",
    });
    expect(malformedPhone.status).toBe(400);

    const registered = await post("/api/auth/register", {
      name: "First User",
      email: "FIRST@gmail.com",
      phone: "+14155550001",
      password: "secure-password-1",
    });
    expect(registered.status).toBe(201);
    expect((await registered.json()).message).toMatch(/successful/i);
    const storedUsers = await readFile(usersFile, "utf8");
    expect(storedUsers).not.toContain("secure-password-1");
    expect(storedUsers).toContain("passwordHash");
    const duplicatePhone = await post("/api/auth/register", {
      name: "Other User",
      email: "other@gmail.com",
      phone: "+14155550001",
      password: "secure-password-2",
    });
    expect(duplicatePhone.status).toBe(409);

    const duplicate = await post("/api/auth/register", {
      name: "First User",
      email: "first@gmail.com",
      phone: "+14155550001",
      password: "secure-password-1",
    });
    expect(duplicate.status).toBe(409);
  });

  it("creates an HttpOnly session cookie and supports refresh through /me", async () => {
    const login = await post("/api/auth/login", {
      email: "first@gmail.com",
      password: "secure-password-1",
    });
    expect(login.status).toBe(200);
    const cookie = sessionCookie(login);
    expect(cookie).toMatch(/^foundry_session=/);
    expect(login.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(login.headers.get("set-cookie")).toMatch(/SameSite=Strict/i);
    const user = (await login.json()).data;
    expect(user).toMatchObject({ name: "First User", email: "first@gmail.com", phone: "+14155550001" });
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("salt");

    const current = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(current.status).toBe(200);
    expect((await current.json()).data.id).toBe(user.id);
  });

  it("rejects private financial APIs without a valid session", async () => {
    for (const path of [
      "/api/calculate/startup-cost",
      "/api/calculate/monthly-financials",
      "/api/calculate/break-even",
    ]) {
      const response = await post(path, {});
      expect(response.status).toBe(401);
      expect((await response.json()).error).toMatch(/authentication/i);
    }

    const malformedRequest = await fetch(`${baseUrl}/api/calculate/startup-cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid json",
    });
    expect(malformedRequest.status).toBe(401);
  });

  it("does not authenticate invalid passwords and revokes sessions on logout", async () => {
    const invalidLogin = await post("/api/auth/login", {
      email: "first@gmail.com",
      password: "wrong-password",
    });
    expect(invalidLogin.status).toBe(401);

    const login = await post("/api/auth/login", {
      email: "first@gmail.com",
      password: "secure-password-1",
    });
    const cookie = sessionCookie(login);
    const loggedOut = await post("/api/auth/logout", {}, cookie);
    expect(loggedOut.status).toBe(200);
    expect(loggedOut.headers.get("set-cookie")).toMatch(/Max-Age=0/);

    const staleSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(staleSession.status).toBe(401);
  });

  it("issues separate sessions and user identities for different accounts", async () => {
    const registration = await post("/api/auth/register", {
      name: "Second User",
      email: "second@gmail.com",
      phone: "+14155550002",
      password: "secure-password-2",
    });
    expect(registration.status).toBe(201);

    const firstLogin = await post("/api/auth/login", {
      email: "first@gmail.com",
      password: "secure-password-1",
    });
    const secondLogin = await post("/api/auth/login", {
      email: "second@gmail.com",
      password: "secure-password-2",
    });
    const firstMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: sessionCookie(firstLogin) } });
    const secondMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: sessionCookie(secondLogin) } });
    expect((await firstMe.json()).data.id).not.toBe((await secondMe.json()).data.id);
  });
});
