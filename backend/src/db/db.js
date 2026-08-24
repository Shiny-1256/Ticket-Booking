import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_FILE || path.join(__dirname, '../../database.sqlite');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'ORGANISER', 'CUSTOMER')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      total_capacity INTEGER NOT NULL,
      rows_count INTEGER NOT NULL,
      cols_count INTEGER NOT NULL,
      layout_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category_type TEXT NOT NULL CHECK(category_type IN ('MOVIE', 'CONCERT', 'THEATRE', 'SPORTS')),
      banner_url TEXT,
      venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      organiser_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      pricing_json TEXT NOT NULL,
      status TEXT DEFAULT 'UPCOMING' CHECK(status IN ('UPCOMING', 'COMPLETED', 'CANCELLED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS show_seats (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      seat_label TEXT NOT NULL,
      row_name TEXT NOT NULL,
      col_num INTEGER NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'HELD', 'OFFERED', 'BOOKED')),
      held_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      held_until DATETIME,
      hold_id TEXT,
      booking_id TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_reference TEXT UNIQUE NOT NULL,
      show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED', 'CANCELLED')),
      qr_code_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cancelled_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS booking_seats (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      show_seat_id TEXT NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
      seat_label TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'WAITING' CHECK(status IN ('WAITING', 'OFFERED', 'FULFILLED', 'EXPIRED', 'CANCELLED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS waitlist_offers (
      id TEXT PRIMARY KEY,
      waitlist_id TEXT NOT NULL REFERENCES waitlist(id) ON DELETE CASCADE,
      show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      show_seat_id TEXT NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'CLAIMED', 'EXPIRED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_seats_show_status ON show_seats(show_id, status);
    CREATE INDEX IF NOT EXISTS idx_seats_held_until ON show_seats(held_until);
    CREATE INDEX IF NOT EXISTS idx_waitlist_queue ON waitlist(show_id, category, status, created_at);
  `);
}

export default db;
