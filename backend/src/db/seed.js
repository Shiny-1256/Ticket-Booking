import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db, { initDatabase } from './db.js';

async function seed() {
  console.log('🌱 Seeding CinePass database...');
  initDatabase();

  // Clear existing tables
  db.exec('DELETE FROM waitlist_offers');
  db.exec('DELETE FROM waitlist');
  db.exec('DELETE FROM booking_seats');
  db.exec('DELETE FROM bookings');
  db.exec('DELETE FROM show_seats');
  db.exec('DELETE FROM shows');
  db.exec('DELETE FROM venues');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM email_logs');

  const defaultPassword = await bcrypt.hash('password123', 10);

  // 1. Create Users
  const adminId = crypto.randomUUID();
  const organiserId = crypto.randomUUID();
  const johnId = crypto.randomUUID();
  const sarahId = crypto.randomUUID();
  const alexId = crypto.randomUUID();

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  insertUser.run(adminId, 'System Admin', 'admin@cinepass.com', defaultPassword, 'ADMIN');
  insertUser.run(organiserId, 'Event Horizon Media', 'organiser@cinepass.com', defaultPassword, 'ORGANISER');
  insertUser.run(johnId, 'John Doe', 'john@example.com', defaultPassword, 'CUSTOMER');
  insertUser.run(sarahId, 'Sarah Jenkins', 'sarah@example.com', defaultPassword, 'CUSTOMER');
  insertUser.run(alexId, 'Alex Mercer', 'alex@example.com', defaultPassword, 'CUSTOMER');

  console.log('✅ Users seeded (admin@cinepass.com, organiser@cinepass.com, john@example.com / password123)');

  // 2. Create Venues
  const venue1Id = crypto.randomUUID();
  const venue1Layout = {
    rowCategories: {
      0: 'VIP',
      1: 'VIP',
      2: 'Premium',
      3: 'Premium',
      4: 'Premium',
      5: 'Standard',
      6: 'Standard',
      7: 'Standard'
    },
    aisleColumns: [3, 9]
  };

  const venue2Id = crypto.randomUUID();
  const venue2Layout = {
    rowCategories: {
      0: 'FrontRow',
      1: 'VIP',
      2: 'VIP',
      3: 'Premium',
      4: 'Premium',
      5: 'Premium',
      6: 'Standard',
      7: 'Standard',
      8: 'Standard',
      9: 'Standard'
    },
    aisleColumns: [4, 10]
  };

  const insertVenue = db.prepare(`
    INSERT INTO venues (id, name, address, city, total_capacity, rows_count, cols_count, layout_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  insertVenue.run(venue1Id, 'Grand Cineplex - Auditorium 1', '452 Sunset Blvd', 'Los Angeles', 96, 8, 12, JSON.stringify(venue1Layout));
  insertVenue.run(venue2Id, 'Metropolis Live Arena', '101 Stadium Way', 'New York', 140, 10, 14, JSON.stringify(venue2Layout));

  console.log('✅ Venues seeded');

  // 3. Create Shows
  const show1Id = crypto.randomUUID();
  const show2Id = crypto.randomUUID();
  const show3Id = crypto.randomUUID(); // Sold-out event for quick waitlist testing!

  const show1Pricing = { VIP: 120, Premium: 80, Standard: 45 };
  const show2Pricing = { FrontRow: 250, VIP: 180, Premium: 120, Standard: 75 };
  const show3Pricing = { VIP: 150, Premium: 95, Standard: 50 };

  const insertShow = db.prepare(`
    INSERT INTO shows (id, title, description, category_type, banner_url, venue_id, organiser_id, start_time, end_time, pricing_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPCOMING', CURRENT_TIMESTAMP)
  `);

  const tomorrow = new Date(Date.now() + 86400000);
  const nextWeek = new Date(Date.now() + 7 * 86400000);
  const endTomorrow = new Date(tomorrow.getTime() + 3 * 3600000);
  const endNextWeek = new Date(nextWeek.getTime() + 4 * 3600000);

  insertShow.run(
    show1Id,
    'Avatar: Fire and Ash 3D IMAX',
    'Experience Pandora like never before in full 3D dual laser IMAX with Dolby Atmos sound.',
    'MOVIE',
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80',
    venue1Id,
    organiserId,
    tomorrow.toISOString(),
    endTomorrow.toISOString(),
    JSON.stringify(show1Pricing)
  );

  insertShow.run(
    show2Id,
    'Coldplay: Music of the Spheres World Tour',
    'The iconic British rock band brings their electrifying sustainable world tour to Metropolis Arena.',
    'CONCERT',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    venue2Id,
    organiserId,
    nextWeek.toISOString(),
    endNextWeek.toISOString(),
    JSON.stringify(show2Pricing)
  );

  insertShow.run(
    show3Id,
    'Interstellar: 10th Anniversary Orchestral Screening',
    'Christopher Nolan classic accompanied live by a 70-piece symphonic orchestra playing Hans Zimmer score.',
    'THEATRE',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    venue1Id,
    organiserId,
    new Date(Date.now() + 2 * 86400000).toISOString(),
    new Date(Date.now() + 2 * 86400000 + 3 * 3600000).toISOString(),
    JSON.stringify(show3Pricing)
  );

  console.log('✅ Shows seeded');

  // 4. Generate seats for shows
  const rowNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const insertSeatStmt = db.prepare(`
    INSERT INTO show_seats (id, show_id, seat_label, row_name, col_num, category, price, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', CURRENT_TIMESTAMP)
  `);

  function buildSeatsForShow(showId, layout, rows, cols, pricing) {
    for (let r = 0; r < rows; r++) {
      const rowName = rowNames[r];
      const category = layout.rowCategories[r] || 'Standard';
      const price = pricing[category] || 50;

      for (let c = 1; c <= cols; c++) {
        insertSeatStmt.run(crypto.randomUUID(), showId, `${rowName}${c}`, rowName, c, category, price);
      }
    }
  }

  buildSeatsForShow(show1Id, venue1Layout, 8, 12, show1Pricing);
  buildSeatsForShow(show2Id, venue2Layout, 10, 14, show2Pricing);
  buildSeatsForShow(show3Id, venue1Layout, 8, 12, show3Pricing);

  // 5. Pre-book all VIP seats for Show 3 (Interstellar) to make VIP category SOLD OUT!
  const vipSeatsShow3 = db.prepare(`SELECT * FROM show_seats WHERE show_id = ? AND category = 'VIP'`).all(show3Id);
  const bookingId = crypto.randomUUID();
  const bookingRef = 'BK-DEMO-SOLD-OUT';

  db.prepare(`
    INSERT INTO bookings (id, booking_reference, show_id, user_id, total_amount, status, qr_code_data, created_at)
    VALUES (?, ?, ?, ?, 2400, 'CONFIRMED', 'MOCK_QR_DATA', CURRENT_TIMESTAMP)
  `).run(bookingId, bookingRef, show3Id, alexId);

  for (const s of vipSeatsShow3) {
    db.prepare(`UPDATE show_seats SET status = 'BOOKED', booking_id = ? WHERE id = ?`).run(bookingId, s.id);
    db.prepare(`
      INSERT INTO booking_seats (id, booking_id, show_seat_id, seat_label, category, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), bookingId, s.id, s.seat_label, s.category, s.price);
  }

  console.log('✅ Initial seat maps seeded (Show 3 VIP seats marked BOOKED for instant waitlist demo testing)');
  console.log('🎉 Seeding complete!');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
