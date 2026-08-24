import db from '../db/db.js';
import { processNextWaitlistOffer } from '../services/waitlistService.js';

export function startTtlWorker(ioInstance, intervalMs = 5000) {
  console.log(`[TTL Worker] Background scheduler started (polling every ${intervalMs}ms)...`);

  setInterval(async () => {
    try {
      // 1. Process Expired Seat Holds
      const expiredHolds = db.prepare(`
        SELECT * FROM show_seats 
        WHERE status = 'HELD' AND held_until IS NOT NULL AND datetime(held_until) <= datetime('now')
      `).all();

      if (expiredHolds.length > 0) {
        console.log(`[TTL Worker] Found ${expiredHolds.length} expired seat hold(s). Cleaning up...`);
        for (const seat of expiredHolds) {
          // Release hold
          db.prepare(`
            UPDATE show_seats
            SET status = 'AVAILABLE', held_by_user_id = NULL, held_until = NULL, hold_id = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'HELD'
          `).run(seat.id);

          // Evaluate waitlist engine
          await processNextWaitlistOffer(seat.show_id, seat.id, seat.category, ioInstance);
        }
      }

      // 2. Process Expired Waitlist Offers
      const expiredOffers = db.prepare(`
        SELECT wo.*, ss.category
        FROM waitlist_offers wo
        JOIN show_seats ss ON wo.show_seat_id = ss.id
        WHERE wo.status = 'PENDING' AND datetime(wo.expires_at) <= datetime('now')
      `).all();

      if (expiredOffers.length > 0) {
        console.log(`[TTL Worker] Found ${expiredOffers.length} expired waitlist offer(s). Passing to next customer...`);
        for (const offer of expiredOffers) {
          // Mark offer as EXPIRED
          db.prepare(`UPDATE waitlist_offers SET status = 'EXPIRED' WHERE id = ?`).run(offer.id);

          // Mark waitlist entry as EXPIRED
          db.prepare(`UPDATE waitlist SET status = 'EXPIRED' WHERE id = ?`).run(offer.waitlist_id);

          // Reset seat status to AVAILABLE briefly before passing to next waitlisted user
          db.prepare(`
            UPDATE show_seats 
            SET status = 'AVAILABLE', held_by_user_id = NULL, held_until = NULL, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND status = 'OFFERED'
          `).run(offer.show_seat_id);

          // Offer to next user in line
          await processNextWaitlistOffer(offer.show_id, offer.show_seat_id, offer.category, ioInstance);
        }
      }
    } catch (err) {
      console.error('[TTL Worker Error]', err);
    }
  }, intervalMs);
}
