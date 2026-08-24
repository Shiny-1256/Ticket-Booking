import express from 'express';
import db from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { joinWaitlist, getWaitlistStatusForUser } from '../services/waitlistService.js';

const router = express.Router();

// Join waitlist for a sold-out category in a show
router.post('/join', authenticateToken, (req, res) => {
  try {
    const { showId, category } = req.body;
    if (!showId || !category) {
      return res.status(400).json({ error: 'showId and category are required' });
    }

    const result = joinWaitlist(req.user.id, showId, category);
    return res.json(result);
  } catch (err) {
    console.error('Join waitlist error:', err);
    return res.status(500).json({ error: err.message || 'Failed to join waitlist' });
  }
});

// Get user waitlists & active seat offers
router.get('/my-status', authenticateToken, (req, res) => {
  try {
    const status = getWaitlistStatusForUser(req.user.id);
    return res.json(status);
  } catch (err) {
    console.error('Waitlist status error:', err);
    return res.status(500).json({ error: 'Failed to retrieve waitlist status' });
  }
});

// Validate specific offer token
router.get('/offer/:token', authenticateToken, (req, res) => {
  const offer = db.prepare(`
    SELECT wo.*, s.title as show_title, ss.seat_label, ss.price, ss.category, v.name as venue_name
    FROM waitlist_offers wo
    JOIN shows s ON wo.show_id = s.id
    JOIN show_seats ss ON wo.show_seat_id = ss.id
    JOIN venues v ON s.venue_id = v.id
    WHERE wo.offer_token = ? AND wo.user_id = ?
  `).get(req.params.token, req.user.id);

  if (!offer) {
    return res.status(404).json({ error: 'Offer not found or expired' });
  }

  const isExpired = new Date(offer.expires_at) <= new Date() || offer.status !== 'PENDING';

  return res.json({
    offer,
    isExpired
  });
});

export default router;
