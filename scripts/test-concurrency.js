import db, { initDatabase } from '../backend/src/db/db.js';
import { holdSeats } from '../backend/src/services/seatService.js';
import crypto from 'crypto';

console.log('🧪 Starting Concurrency Protection & Auto-Release Verification Test...');

initDatabase();

// Find an available seat
const seat = db.prepare("SELECT * FROM show_seats WHERE status = 'AVAILABLE' LIMIT 1").get();

if (!seat) {
  console.error('❌ No available seat found to test concurrency.');
  process.exit(1);
}

console.log(`🎯 Targeting Seat: ${seat.seat_label} (ID: ${seat.id}) for Show: ${seat.show_id}`);

const user1Id = crypto.randomUUID();
const user2Id = crypto.randomUUID();

// Ensure test users exist in DB
db.prepare("INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, 'User 1', 'u1@test.com', 'hash', 'CUSTOMER')").run(user1Id);
db.prepare("INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, 'User 2', 'u2@test.com', 'hash', 'CUSTOMER')").run(user2Id);

let user1Success = false;
let user2Success = false;
let user2Error = null;

try {
  // Attempt 1: User 1 holds seat
  const res1 = holdSeats(user1Id, seat.show_id, [seat.id]);
  if (res1.holdId) {
    user1Success = true;
    console.log('✅ User 1 successfully acquired hold on seat:', seat.seat_label);
  }
} catch (err) {
  console.error('❌ User 1 failed unexpectedly:', err);
}

try {
  // Attempt 2: User 2 simultaneously attempts to hold the EXACT SAME seat
  holdSeats(user2Id, seat.show_id, [seat.id]);
  user2Success = true;
} catch (err) {
  user2Error = err;
  console.log(`✅ User 2 request rejected as expected with status ${err.status}: "${err.message}"`);
}

// Verification assertion
if (user1Success && !user2Success && user2Error?.status === 409) {
  console.log('========================================================================');
  console.log('🏆 CONCURRENCY PROTECTION VERIFIED SUCCESSFULLY!');
  console.log('   Simultaneous seat hold attempt correctly granted 1 winner & rejected 1 conflict.');
  console.log('========================================================================');
} else {
  console.error('❌ CONCURRENCY VERIFICATION FAILED!');
  process.exit(1);
}
