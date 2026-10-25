import { apiUrl } from "./http.js";

async function requestAuth(path, body) {
  let response;
  try {
    response = await fetch(apiUrl(`/api/auth/${path}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Unable to reach the authentication service. Make sure the backend is running.");
  }
  return readAuthResponse(response);
}

async function readAuthResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The authentication service returned an invalid response.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The authentication service returned an invalid response.");
  }
  if (!response.ok || payload.success !== true) {
    throw new Error(typeof payload.error === "string" ? payload.error : "The authentication request could not be completed.");
  }
  return payload;
}

export async function checkCurrentUser() {
  let response;
  try {
    response = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
  } catch {
    throw new Error("Unable to reach the authentication service. Make sure the backend is running.");
  }
  if (response.status === 401) return null;
  const payload = await readAuthResponse(response);
  if (!payload.data || typeof payload.data.id !== "string" || typeof payload.data.email !== "string") {
    throw new Error("The authentication service returned an unexpected user response.");
  }
  return payload.data;
}

export async function registerAccount(values) {
  return requestAuth("register", values);
}

export async function loginAccount(values) {
  const payload = await requestAuth("login", values);
  if (!payload.data || typeof payload.data.id !== "string" || typeof payload.data.email !== "string") {
    throw new Error("The authentication service returned an unexpected user response.");
  }
  return payload.data;
}

export async function logoutAccount() {
  return requestAuth("logout", {});
}
