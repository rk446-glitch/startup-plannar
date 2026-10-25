const MAX_REQUEST_BYTES = 1024 * 1024;

async function readRequestBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_REQUEST_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendError(response, status, message) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ success: false, error: message }));
}

export default async function handler(request, response) {
  const backendOrigin = process.env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    sendError(response, 503, "The API backend has not been configured.");
    return;
  }

  let origin;
  let target;
  try {
    origin = new URL(backendOrigin);
    if (origin.protocol !== "https:" && process.env.NODE_ENV === "production") {
      sendError(response, 500, "The production API backend must use HTTPS.");
      return;
    }
    target = new URL(request.url, origin);
  } catch {
    sendError(response, 500, "The API backend configuration is invalid.");
    return;
  }

  if (target.origin !== origin.origin || !target.pathname.startsWith("/api/")) {
    sendError(response, 400, "Invalid API path.");
    return;
  }

  try {
    const headers = new Headers();
    for (const name of ["accept", "content-type", "cookie", "origin"]) {
      const value = request.headers[name];
      if (typeof value === "string") headers.set(name, value);
    }
    const method = request.method || "GET";
    const body = ["GET", "HEAD"].includes(method) ? undefined : await readRequestBody(request);
    const upstream = await fetch(target, { method, headers, body, redirect: "manual" });

    response.statusCode = upstream.status;
    for (const name of ["content-type", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    }
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) response.setHeader("Set-Cookie", setCookie);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    if (error.statusCode === 413) {
      sendError(response, 413, error.message);
      return;
    }
    sendError(response, 502, "The API backend could not complete the request.");
  }
}
