import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Use existing DB file in server/src
// Get the directory of the current file (server/src)
const __filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(__filename);
const dbPath = path.join(currentDir, "local_vectors.db");
const extPath = path.join(currentDir, "vec0.dll");

console.log(dbPath);
console.log(extPath);

const db = new Database(dbPath);

// Load vec0 extension if available
try {
  if (fs.existsSync(extPath)) {
    db.loadExtension(extPath);
    console.log("✅ vec0 extension loaded successfully");
  } else {
    console.warn("⚠️ vec0.dll not found, vector search may not work");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (error: any) {
  console.warn("⚠️ Failed to load vec0 extension:", error.message);
}

// Try test function if vec is loaded
try {
  const ver = db.prepare("SELECT vec_version()").get();
  console.log("vec_version():", ver);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (err: any) {
  console.warn("vec_version test failed:", err.message);
}

export default db;
