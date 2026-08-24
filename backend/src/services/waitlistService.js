import crypto from 'crypto';
import db from '../db/db.js';
import { sendWaitlistOfferEmail } from './emailService.js';

export function joinWaitlist(userId, showId, category) {
  // Check if show exists
  const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
  if (!show) {
    throw new Error('Show not found');
  }

  // Check if user is already on active waitlist for this show and category
  const existing = db.prepare(`
    SELECT * FROM waitlist 
    WHERE show_id = ? AND user_id = ? AND category = ? AND status = 'WAITING'
  `).get(showId, userId, category);

  if (existing) {
    return { message: 'Already on waitlist for this category', waitlist: existing };
  }

  const waitlistId = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO waitlist (id, show_id, user_id, category, status, created_at)
    VALUES (?, ?, ?, ?, 'WAITING', CURRENT_TIMESTAMP)
  `);

  stmt.run(waitlistId, showId, userId, category);

  const entry = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId);
  
  // Calculate queue position
  const queuePos = db.prepare(`
    SELECT COUNT(*) as count FROM waitlist 
    WHERE show_id = ? AND category = ? AND status = 'WAITING' AND created_at <= ?
  `).get(showId, category, entry.created_at).count;

  return { message: 'Successfully joined waitlist', waitlist: entry, queuePosition: queuePos };
}

/**
 * Triggered when a seat in a category becomes available (e.g., booking cancelled, hold released, offer expired).
 * Finds the oldest WAITING customer for that show & category, creates a time-limited offer, and marks the seat OFFERED.
 */
export async function processNextWaitlistOffer(showId, seatId, category, ioInstance = null) {
  const transaction = db.transaction(() => {
    // 1. Get the seat
    const seat = db.prepare('SELECT * FROM show_seats WHERE id = ? AND show_id = ?').get(seatId, showId);
    if (!seat) return null;

    // 2. Find oldest WAITING customer in queue
    const topWaitlist = db.prepare(`
      SELECT w.*, u.name as user_name, u.email as user_email
      FROM waitlist w
      JOIN users u ON w.user_id = u.id
      WHERE w.show_id = ? AND w.category = ? AND w.status = 'WAITING'
      ORDER BY w.created_at ASC
      LIMIT 1
    `).get(showId, category);

    if (!topWaitlist) {
      // No waitlist left, return seat to AVAILABLE
      db.prepare(`
        UPDATE show_seats
        SET status = 'AVAILABLE', held_by_user_id = NULL, held_until = NULL, hold_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(seatId);
      return { action: 'RETURNED_TO_AVAILABLE', seatId };
    }

    // 3. Create time-limited offer (TTL from env or 5 mins)
    const offerTtlMinutes = Number(process.env.WAITLIST_OFFER_TTL_MINUTES) || 5;
    const expiresAt = new Date(Date.now() + offerTtlMinutes * 60 * 1000).toISOString();
    const offerToken = crypto.randomBytes(16).toString('hex');
    const offerId = crypto.randomUUID();

    // 4. Update waitlist status to OFFERED
    db.prepare(`UPDATE waitlist SET status = 'OFFERED' WHERE id = ?`).run(topWaitlist.id);

    // 5. Insert waitlist_offer record
    db.prepare(`
      INSERT INTO waitlist_offers (id, waitlist_id, show_id, show_seat_id, user_id, offer_token, expires_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
    `).run(offerId, topWaitlist.id, showId, seatId, topWaitlist.user_id, offerToken, expiresAt);

    // 6. Update seat status to OFFERED and set held_by_user_id
    db.prepare(`
      UPDATE show_seats
      SET status = 'OFFERED', held_by_user_id = ?, held_until = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(topWaitlist.user_id, expiresAt, seatId);

    // Get show details for email
    const show = db.prepare('SELECT title FROM shows WHERE id = ?').get(showId);

    return {
      action: 'OFFER_CREATED',
      offerId,
      offerToken,
      expiresAt,
      seat,
      user: {
        id: topWaitlist.user_id,
        name: topWaitlist.user_name,
        email: topWaitlist.user_email
      },
      showTitle: show ? show.title : 'Event'
    };
  });

  const result = transaction();

  if (result && result.action === 'OFFER_CREATED') {
    // Send email notification asynchronously
    sendWaitlistOfferEmail(result.user.email, result.user.name, {
      offer_token: result.offerToken,
      show_title: result.showTitle,
      category: category,
      seat_label: result.seat.seat_label,
      price: result.seat.price,
      expires_at: result.expiresAt
    }).catch(err => console.error('Failed to send waitlist email:', err));

    if (ioInstance) {
      ioInstance.to(`show:${showId}`).emit('seatStatusUpdated', {
        showId,
        seatId,
        status: 'OFFERED',
        heldUntil: result.expiresAt
      });
    }
  } else if (result && result.action === 'RETURNED_TO_AVAILABLE') {
    if (ioInstance) {
      ioInstance.to(`show:${showId}`).emit('seatStatusUpdated', {
        showId,
        seatId,
        status: 'AVAILABLE'
      });
    }
  }

  return result;
}

export function getWaitlistStatusForUser(userId) {
  const waitlists = db.prepare(`
    SELECT w.*, s.title as show_title, s.banner_url, v.name as venue_name
    FROM waitlist w
    JOIN shows s ON w.show_id = s.id
    JOIN venues v ON s.venue_id = v.id
    WHERE w.user_id = ? AND w.status IN ('WAITING', 'OFFERED')
    ORDER BY w.created_at DESC
  `).all(userId);

  const activeOffers = db.prepare(`
    SELECT wo.*, s.title as show_title, ss.seat_label, ss.price, ss.category
    FROM waitlist_offers wo
    JOIN shows s ON wo.show_id = s.id
    JOIN show_seats ss ON wo.show_seat_id = ss.id
    WHERE wo.user_id = ? AND wo.status = 'PENDING' AND wo.expires_at > CURRENT_TIMESTAMP
    ORDER BY wo.expires_at ASC
  `).all(userId);

  return { waitlists, activeOffers };
}
