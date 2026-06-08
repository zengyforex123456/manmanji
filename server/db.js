// server/db.js - Persistent SQLite storage for Kaoshi
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'kaoshi.db');

let dbInstance = null;

/**
 * Initialize SQLite DB and create necessary tables.
 */
export async function initDB() {
  if (dbInstance) return dbInstance;
  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
  // Users table
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      nickName TEXT,
      createdAt TEXT,
      membershipTier TEXT,
      token TEXT
    );
  `);
  // Progress table (JSON state per subject)
    // Questions table (stores exam questions)\n  await dbInstance.exec(`\n    CREATE TABLE IF NOT EXISTS questions (\n      id TEXT PRIMARY KEY,\n      subjectId TEXT,\n      stem TEXT,\n      type TEXT,\n      options TEXT,\n      answer TEXT,\n      analysis TEXT,\n      difficulty INTEGER,\n      tags TEXT,\n      module TEXT,\n      chapter INTEGER,\n      mnemonic TEXT,\n      newContent INTEGER,\n      accuracy REAL,\n      source TEXT\n    );\n  `);
  return dbInstance;
}

export function getDB() {
  if (!dbInstance) throw new Error('DB not initialized');
  return dbInstance;
}

// Helper to close DB (optional)
export async function closeDB() {
  if (dbInstance) await dbInstance.close();
  dbInstance = null;
}
