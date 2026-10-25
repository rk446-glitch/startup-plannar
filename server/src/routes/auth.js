const crypto = require("node:crypto");
const express = require("express");
const { addUser, findUserByEmail, findUserById, hasEmailOrPhone } = require("../auth/userStore");
const {
  clearSessionCookie,
  createSession,
  getSessionUserId,
  hashPassword,
  requireAuth,
  revokeSession,
  verifyPassword,
} = require("../auth/session");

const router = express.Router();
const gmailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i;
const phonePattern = /^\+[1-9]\d{7,14}$/;

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone ?? "" };
}

function validCredentials(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }
  if (typeof body.email !== "string" || !gmailPattern.test(body.email.trim()) || body.email.length > 254) {
    return "Enter a valid Gmail address ending in @gmail.com.";
  }
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
    return "Password must be between 8 and 128 characters.";
  }
  return "";
}

router.post("/register", async (request, response, next) => {
  try {
    const validationError = validCredentials(request.body);
    if (validationError) {
      response.status(400).json({ success: false, error: validationError });
      return;
    }

    const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
    if (!name || name.length > 80) {
      response.status(400).json({ success: false, error: "Name is required and must be 80 characters or fewer." });
      return;
    }
    const phone = typeof request.body.phone === "string" ? request.body.phone.trim() : "";
    if (!phonePattern.test(phone)) {
      response.status(400).json({ success: false, error: "Enter a phone number in international format, for example +14155552671." });
      return;
    }

    const email = request.body.email.trim().toLowerCase();
    if (await hasEmailOrPhone(email, phone)) {
      response.status(409).json({ success: false, error: "An account with this email or phone number already exists." });
      return;
    }

    const { salt, passwordHash } = await hashPassword(request.body.password);
    const user = { id: crypto.randomUUID(), name, email, phone, salt, passwordHash };
    if (!(await addUser(user))) {
      response.status(409).json({ success: false, error: "An account with this email or phone number already exists." });
      return;
    }
    response.status(201).json({ success: true, message: "Registration successful. You can now log in." });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (request, response, next) => {
  try {
    const validationError = validCredentials(request.body);
    if (validationError) {
      response.status(400).json({ success: false, error: validationError });
      return;
    }
    const email = request.body.email.trim().toLowerCase();
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(request.body.password, user.salt, user.passwordHash))) {
      response.status(401).json({ success: false, error: "Email or password is incorrect." });
      return;
    }
    await revokeSession(request);
    await createSession(response, user.id);
    response.json({ success: true, data: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (request, response, next) => {
  try {
    const user = await findUserById(request.userId);
    if (!user) {
      await revokeSession(request);
      clearSessionCookie(response);
      response.status(401).json({ success: false, error: "Authentication session is no longer valid." });
      return;
    }
    response.json({ success: true, data: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (request, response, next) => {
  try {
    await revokeSession(request);
    clearSessionCookie(response);
    response.json({ success: true, message: "You have been logged out." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
