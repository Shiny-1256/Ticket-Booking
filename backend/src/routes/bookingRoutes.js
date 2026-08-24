import express from 'express';
import db from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { holdSeats, releaseSeats, confirmBooking, cancelBooking } from '../services/seatService.js';

const router = express.Router();

// Hold seats with TTL
router.post('/hold', authenticateToken, (req, res) => {
  try {
    const { showId, seatIds } = req.body;
    if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'showId and array of seatIds are required' });
    }

    const io = req.app.get('io');
    const result = holdSeats(req.user.id, showId, seatIds, io);

    return res.json({
      message: 'Seats held successfully',
      holdId: result.holdId,
      heldUntil: result.heldUntil,
      seatIds
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Hold seats error:', err);
    return res.status(500).json({ error: 'Failed to hold seats' });
  }
});

// Release held seats (checkout abandon)
router.post('/release', authenticateToken, (req, res) => {
  try {
    const { showId, seatIds } = req.body;
    if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'showId and array of seatIds are required' });
    }

    const io = req.app.get('io');
    const released = releaseSeats(req.user.id, showId, seatIds, io);

    return res.json({
      message: 'Seats released',
      releasedCount: released.length
    });
  } catch (err) {
    console.error('Release seats error:', err);
    return res.status(500).json({ error: 'Failed to release seats' });
  }
});

// Confirm booking
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const { showId, seatIds, offerToken } = req.body;
    if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'showId and array of seatIds are required' });
    }

    const io = req.app.get('io');
    const booking = await confirmBooking(req.user.id, showId, seatIds, offerToken, io);

    return res.status(201).json({
      message: 'Booking confirmed successfully!',
      booking
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Confirm booking error:', err);
    return res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// Get customer booking history
router.get('/my-bookings', authenticateToken, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, s.title as show_title, s.start_time, s.end_time, v.name as venue_name, v.city
    FROM bookings b
    JOIN shows s ON b.show_id = s.id
    JOIN venues v ON s.venue_id = v.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user.id);

  const enriched = bookings.map(b => {
    const seats = db.prepare('SELECT seat_label, category, price FROM booking_seats WHERE booking_id = ?').all(b.id);
    return {
      ...b,
      seats
    };
  });

  return res.json({ bookings: enriched });
});

// Cancel booking
router.post('/cancel', authenticateToken, (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    const io = req.app.get('io');
    const result = cancelBooking(req.user.id, bookingId, io);

    return res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Cancel booking error:', err);
    return res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
