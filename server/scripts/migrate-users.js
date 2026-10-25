const fs = require("node:fs/promises");
const path = require("node:path");
const { closeDatabase, getPool, initializeDatabase, isDatabaseConfigured } = require("../src/db");

async function migrateUsers() {
  if (!isDatabaseConfigured()) {
    throw new Error("Set DATABASE_URL to the target PostgreSQL database before migrating users.");
  }
  const sourcePath = process.env.AUTH_USERS_FILE || path.join(__dirname, "../data/users.json");
  const contents = await fs.readFile(sourcePath, "utf8");
  const users = JSON.parse(contents);
  if (!Array.isArray(users)) throw new Error("The local user store must contain a JSON array.");

  await initializeDatabase();
  const database = getPool();
  const client = await database.connect();
  let imported = 0;
  try {
    await client.query("BEGIN");
    for (const user of users) {
      if (
        !user ||
        typeof user.id !== "string" ||
        typeof user.name !== "string" ||
        typeof user.email !== "string" ||
        typeof user.salt !== "string" ||
        typeof user.passwordHash !== "string"
      ) {
        throw new Error("A local account record is incomplete; migration was cancelled.");
      }
      const result = await client.query(
        `INSERT INTO users (id, name, email, phone, salt, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name, user.email, user.phone || null, user.salt, user.passwordHash],
      );
      imported += result.rowCount;
    }
    await client.query("COMMIT");
    console.log(`Imported ${imported} account(s). Existing matching user IDs were left unchanged.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closeDatabase();
  }
}

migrateUsers().catch((error) => {
  console.error("User migration failed:", error.message);
  process.exitCode = 1;
});
