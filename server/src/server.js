const app = require("./app");
const { initializeDatabase, isDatabaseConfigured } = require("./db");

const port = process.env.PORT || 5000;

async function startServer() {
  if (process.env.NODE_ENV === "production" && !isDatabaseConfigured()) {
    throw new Error("Production startup requires DATABASE_URL for persistent accounts and sessions.");
  }
  if (process.env.NODE_ENV === "production" && !process.env.CLIENT_ORIGIN) {
    throw new Error("Production startup requires CLIENT_ORIGIN to restrict credentialed browser requests.");
  }
  if (isDatabaseConfigured()) await initializeDatabase();
  app.listen(port, () => {
    console.log(`API server is running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("API server failed to start:", error.message);
  process.exitCode = 1;
});
