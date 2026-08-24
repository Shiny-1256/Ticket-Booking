import crypto from 'crypto';
import db from '../db/db.js';
import { processNextWaitlistOffer } from './waitlistService.js';
import { generateTicketQRCode, sendTicketEmail } from './emailService.js';

export function holdSeats(userId, showId, seatIds, ioInstance = null) {
  const ttlMinutes = Number(process.env.SEAT_HOLD_TTL_MINUTES) || 10;
  const heldUntil = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const holdId = crypto.randomUUID();

  // Use SQLite BEGIN IMMEDIATE transaction for strong concurrency lock
  const holdTransaction = db.transaction(() => {
    // 1. First, check if any seats are already held/booked by another user or unavailable
    const placeholders = seatIds.map(() => '?').join(',');
    const seats = db.prepare(`
      SELECT * FROM show_seats 
      WHERE id IN (${placeholders}) AND show_id = ?
    `).all(...seatIds, showId);

    if (seats.length !== seatIds.length) {
      throw { status: 400, message: 'One or more invalid seat IDs requested' };
    }

    // Check for non-AVAILABLE status (unless held by the exact same user)
    const unavailable = seats.filter(s => {
      if (s.status === 'AVAILABLE') return false;
      if (s.status === 'HELD' && s.held_by_user_id === userId && new Date(s.held_until) > new Date()) {
        return false; // User renewing/extending their own hold
      }
      return true;
    });

    if (unavailable.length > 0) {
      const labels = unavailable.map(s => s.seat_label).join(', ');
      throw { status: 409, message: `Seat(s) [${labels}] are no longer available or held by another user.` };
    }

    // 2. Perform atomic UPDATE statement for each seat
    const updateStmt = db.prepare(`
      UPDATE show_seats
      SET status = 'HELD',
          held_by_user_id = ?,
          held_until = ?,
          hold_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND (status = 'AVAILABLE' OR (status = 'HELD' AND held_by_user_id = ?))
    `);

    for (const seatId of seatIds) {
      const info = updateStmt.run(userId, heldUntil, holdId, seatId, userId);
      if (info.changes === 0) {
        // Concurrency conflict: another user acquired hold milliseconds before!
        throw { status: 409, message: `Seat reservation conflict for seat ${seatId}. Please select another seat.` };
      }
    }

    return { holdId, heldUntil, seats };
  });

  const result = holdTransaction();

  // Broadcast real-time seat status update via Socket.IO
  if (ioInstance) {
    for (const seatId of seatIds) {
      ioInstance.to(`show:${showId}`).emit('seatStatusUpdated', {
        showId,
        seatId,
        status: 'HELD',
        heldByUserId: userId,
        heldUntil
      });
    }
  }

  return result;
}

export function releaseSeats(userId, showId, seatIds, ioInstance = null) {
  const releaseTx = db.transaction(() => {
    const placeholders = seatIds.map(() => '?').join(',');
    const seats = db.prepare(`
      SELECT * FROM show_seats 
      WHERE id IN (${placeholders}) AND show_id = ? AND status = 'HELD' AND held_by_user_id = ?
    `).all(...seatIds, showId, userId);

    if (seats.length === 0) return [];

    const updateStmt = db.prepare(`
      UPDATE show_seats
      SET status = 'AVAILABLE',
          held_by_user_id = NULL,
          held_until = NULL,
          hold_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'HELD' AND held_by_user_id = ?
    `);

    for (const seat of seats) {
      updateStmt.run(seat.id, userId);
    }

    return seats;
  });

  const releasedSeats = releaseTx();

  for (const seat of releasedSeats) {
    processNextWaitlistOffer(showId, seat.id, seat.category, ioInstance);
  }

  return releasedSeats;
}

export async function confirmBooking(userId, showId, seatIds, offerToken = null, ioInstance = null) {
  let offer = null;
  if (offerToken) {
    offer = db.prepare(`
      SELECT * FROM waitlist_offers 
      WHERE offer_token = ? AND user_id = ? AND status = 'PENDING' AND expires_at > CURRENT_TIMESTAMP
    `).get(offerToken, userId);

    if (!offer) {
      throw { status: 400, message: 'Invalid or expired waitlist offer token' };
    }
  }

  const bookingRef = 'BK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const bookingId = crypto.randomUUID();

  // Generate QR Code data
  const qrCodeData = await generateTicketQRCode(bookingRef);

  const confirmTx = db.transaction(() => {
    const placeholders = seatIds.map(() => '?').join(',');
    const seats = db.prepare(`
      SELECT * FROM show_seats 
      WHERE id IN (${placeholders}) AND show_id = ?
    `).all(...seatIds, showId);

    if (seats.length !== seatIds.length) {
      throw { status: 400, message: 'Invalid seat selection' };
    }

    // Verify hold ownership or active offer ownership
    for (const s of seats) {
      if (s.status === 'BOOKED') {
        throw { status: 409, message: `Seat ${s.seat_label} is already booked!` };
      }
      if (s.status === 'HELD' && s.held_by_user_id !== userId) {
        throw { status: 403, message: `Seat ${s.seat_label} is held by another customer.` };
      }
      if (s.status === 'OFFERED' && s.held_by_user_id !== userId) {
        throw { status: 403, message: `Seat ${s.seat_label} was offered to a different waitlisted customer.` };
      }
    }

    const totalAmount = seats.reduce((acc, curr) => acc + curr.price, 0);

    // Insert booking
    db.prepare(`
      INSERT INTO bookings (id, booking_reference, show_id, user_id, total_amount, status, qr_code_data, created_at)
      VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, CURRENT_TIMESTAMP)
    `).run(bookingId, bookingRef, showId, userId, totalAmount, qrCodeData);

    // Insert booking_seats & update show_seats to BOOKED
    const updateSeatStmt = db.prepare(`
      UPDATE show_seats
      SET status = 'BOOKED',
          booking_id = ?,
          held_by_user_id = NULL,
          held_until = NULL,
          hold_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertBookingSeatStmt = db.prepare(`
      INSERT INTO booking_seats (id, booking_id, show_seat_id, seat_label, category, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const seat of seats) {
      updateSeatStmt.run(bookingId, seat.id);
      insertBookingSeatStmt.run(crypto.randomUUID(), bookingId, seat.id, seat.seat_label, seat.category, seat.price);
    }

    // If this was fulfilled via waitlist offer, update offer & waitlist status
    if (offer) {
      db.prepare(`UPDATE waitlist_offers SET status = 'CLAIMED' WHERE id = ?`).run(offer.id);
      db.prepare(`UPDATE waitlist SET status = 'FULFILLED' WHERE id = ?`).run(offer.waitlist_id);
    }

    return { bookingId, bookingRef, totalAmount, seats };
  });

  const result = confirmTx();

  // Fetch full details for email
  const show = db.prepare('SELECT title, start_time, v.name as venue_name, v.city FROM shows s JOIN venues v ON s.venue_id = v.id WHERE s.id = ?').get(showId);
  const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);

  const bookingPayload = {
    booking_reference: result.bookingRef,
    show_title: show.title,
    start_time: show.start_time,
    venue_name: show.venue_name,
    city: show.city,
    seat_labels: result.seats.map(s => s.seat_label),
    total_amount: result.totalAmount,
    qr_code_data: qrCodeData
  };

  // Dispatch email notification asynchronously
  sendTicketEmail(user.email, user.name, bookingPayload).catch(err => console.error('Ticket email dispatch error:', err));

  // Socket.IO broadcast
  if (ioInstance) {
    for (const seatId of seatIds) {
      ioInstance.to(`show:${showId}`).emit('seatStatusUpdated', {
        showId,
        seatId,
        status: 'BOOKED'
      });
    }
  }

  return {
    bookingId: result.bookingId,
    bookingReference: result.bookingRef,
    totalAmount: result.totalAmount,
    qrCodeData,
    seats: result.seats
  };
}

export function cancelBooking(userId, bookingId, ioInstance = null) {
  const cancelTx = db.transaction(() => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ? AND status = \'CONFIRMED\'').get(bookingId, userId);
    if (!booking) {
      throw { status: 404, message: 'Active booking not found or already cancelled' };
    }

    // Update booking status
    db.prepare('UPDATE bookings SET status = \'CANCELLED\', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?').run(bookingId);

    // Find linked seats
    const bSeats = db.prepare('SELECT * FROM booking_seats WHERE booking_id = ?').all(bookingId);

    const seatIdsToProcess = [];
    for (const bs of bSeats) {
      // Temporarily mark seat AVAILABLE so processNextWaitlistOffer can process it
      db.prepare(`
        UPDATE show_seats 
        SET status = 'AVAILABLE', booking_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(bs.show_seat_id);

      const seat = db.prepare('SELECT * FROM show_seats WHERE id = ?').get(bs.show_seat_id);
      if (seat) {
        seatIdsToProcess.push(seat);
      }
    }

    return { booking, seatIdsToProcess };
  });

  const { booking, seatIdsToProcess } = cancelTx();

  // For each freed seat, check waitlist engine to offer to next customer
  for (const seat of seatIdsToProcess) {
    processNextWaitlistOffer(booking.show_id, seat.id, seat.category, ioInstance);
  }

  return { message: 'Booking successfully cancelled and seat offered to waitlist', bookingId };
}
