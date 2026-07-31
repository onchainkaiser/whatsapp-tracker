const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('messages.db');
module.exports = db;

db.exec(`
    CREATE TABLE IF NOT EXISTS messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT,
    body TEXT,
    timestamp INTEGER
    )
`)

try {
  db.exec('ALTER TABLE messages ADD COLUMN contact_name TEXT');
} catch (e) {
  // Column already exists — safe to ignore
}