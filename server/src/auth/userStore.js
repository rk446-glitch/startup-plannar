const fs = require("node:fs/promises");
const path = require("node:path");
const { getPool, isDatabaseConfigured } = require("../db");

let pendingWrite = Promise.resolve();

function userFilePath() {
  return process.env.AUTH_USERS_FILE || path.join(__dirname, "../../data/users.json");
}

async function readUsers() {
  const filePath = userFilePath();
  try {
    const content = await fs.readFile(filePath, "utf8");
    const users = JSON.parse(content);
    if (!Array.isArray(users)) throw new Error("User store format is invalid.");
    return users;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeUsers(users) {
  const filePath = userFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(users, null, 2), { mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

async function findUserByEmail(email) {
  if (isDatabaseConfigured()) {
    const { rows } = await getPool().query(
      "SELECT id, name, email, phone, salt, password_hash AS \"passwordHash\" FROM users WHERE email = $1 LIMIT 1",
      [email],
    );
    return rows[0] ?? null;
  }
  return (await readUsers()).find((user) => user.email === email) ?? null;
}

async function findUserById(id) {
  if (isDatabaseConfigured()) {
    const { rows } = await getPool().query(
      "SELECT id, name, email, phone, salt, password_hash AS \"passwordHash\" FROM users WHERE id = $1 LIMIT 1",
      [id],
    );
    return rows[0] ?? null;
  }
  return (await readUsers()).find((user) => user.id === id) ?? null;
}

async function hasEmailOrPhone(email, phone) {
  if (isDatabaseConfigured()) {
    const { rowCount } = await getPool().query(
      "SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1",
      [email, phone],
    );
    return rowCount > 0;
  }
  return (await readUsers()).some((user) => user.email === email || user.phone === phone);
}

async function addUser(user) {
  if (isDatabaseConfigured()) {
    try {
      await getPool().query(
        `INSERT INTO users (id, name, email, phone, salt, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, user.name, user.email, user.phone, user.salt, user.passwordHash],
      );
      return true;
    } catch (error) {
      if (error.code === "23505") return false;
      throw error;
    }
  }
  const operation = pendingWrite.then(async () => {
    const users = await readUsers();
    if (users.some((existing) => existing.email === user.email || existing.phone === user.phone)) return false;
    users.push(user);
    await writeUsers(users);
    return true;
  });
  pendingWrite = operation.catch(() => {});
  return operation;
}

module.exports = { addUser, findUserByEmail, findUserById, hasEmailOrPhone };
