const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./auth/session");
const { getPool, isDatabaseConfigured } = require("./db");
const authRoutes = require("./routes/auth");
const calculationRoutes = require("./routes/calculations");

const app = express();

function allowedOrigins() {
  return new Set(
    (process.env.CLIENT_ORIGIN || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5177,http://127.0.0.1:5177"))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  );
}

function isAllowedOrigin(origin) {
  if (allowedOrigins().has(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const parsedOrigin = new URL(origin);
    return (
      parsedOrigin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsedOrigin.hostname)
    );
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, !origin || isAllowedOrigin(origin));
  },
  credentials: true,
};

function validateRequestOrigin(request, response, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    next();
    return;
  }
  const origin = request.get("origin");
  if ((!origin && process.env.NODE_ENV === "production") || (origin && !isAllowedOrigin(origin))) {
    response.status(403).json({ success: false, error: "Request origin is not allowed." });
    return;
  }
  next();
}

app.use(cors(corsOptions));
app.use("/api/auth", validateRequestOrigin);
app.use("/api/calculate", validateRequestOrigin);
app.use("/api/calculate", requireAuth);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/calculate", calculationRoutes);

app.get("/api/health", (req, res) => {
  if (!isDatabaseConfigured()) {
    res.json({ status: "ok", message: "Server is running" });
    return;
  }
  getPool().query("SELECT 1")
    .then(() => res.json({ status: "ok", message: "Server and database are running" }))
    .catch(() => res.status(503).json({ status: "error", message: "Database is unavailable" }));
});

app.get("/api", (req, res) => {
  res.json({
    name: "Startup Cost and Profitability Analysis System",
    status: "API is running",
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ success: false, error: "Request body must contain valid JSON." });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
