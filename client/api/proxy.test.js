import { Readable } from "node:stream";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import handler from "./[...path].js";

const originalBackendOrigin = process.env.BACKEND_ORIGIN;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalBackendOrigin === undefined) delete process.env.BACKEND_ORIGIN;
  else process.env.BACKEND_ORIGIN = originalBackendOrigin;
  globalThis.fetch = originalFetch;
});

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value = "") {
      this.body = Buffer.from(value).toString();
    },
  };
}

function mockRequest({ url = "/api/auth/me", method = "GET", headers = {}, body = "" } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.url = url;
  request.method = method;
  request.headers = headers;
  return request;
}

describe("same-origin Vercel API proxy", () => {
  it("forwards authenticated API requests and preserves session cookies", async () => {
    process.env.BACKEND_ORIGIN = "https://api.example.test";
    let requestOptions;
    globalThis.fetch = async (url, options) => {
      requestOptions = { url: String(url), options };
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "foundry_session=token; HttpOnly; SameSite=Strict",
        },
      });
    };

    const response = mockResponse();
    await handler(
      mockRequest({
        url: "/api/auth/login",
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "foundry_session=old",
          origin: "https://app.example.test",
        },
        body: JSON.stringify({ email: "user@gmail.com" }),
      }),
      response,
    );

    assert.equal(requestOptions.url, "https://api.example.test/api/auth/login");
    assert.equal(requestOptions.options.headers.get("cookie"), "foundry_session=old");
    assert.equal(requestOptions.options.headers.get("origin"), "https://app.example.test");
    assert.equal(requestOptions.options.body.toString(), JSON.stringify({ email: "user@gmail.com" }));
    assert.match(response.headers["set-cookie"], /HttpOnly/);
    assert.deepEqual(JSON.parse(response.body), { success: true });
  });

  it("returns an explicit configuration error when the backend origin is missing", async () => {
    delete process.env.BACKEND_ORIGIN;
    const response = mockResponse();
    await handler(mockRequest(), response);
    assert.equal(response.statusCode, 503);
    assert.match(JSON.parse(response.body).error, /not been configured/i);
  });

  it("rejects paths outside the API prefix", async () => {
    process.env.BACKEND_ORIGIN = "https://api.example.test";
    const response = mockResponse();
    await handler(mockRequest({ url: "/other/path" }), response);
    assert.equal(response.statusCode, 400);
  });

  it("rejects oversized request bodies", async () => {
    process.env.BACKEND_ORIGIN = "https://api.example.test";
    const response = mockResponse();
    await handler(
      mockRequest({ url: "/api/calculate/startup-cost", method: "POST", body: Buffer.alloc(1024 * 1024 + 1) }),
      response,
    );
    assert.equal(response.statusCode, 413);
  });
});
