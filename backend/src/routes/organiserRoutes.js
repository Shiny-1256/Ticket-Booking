import express from 'express';
import db from '../db/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Organiser dashboard analytics & revenue breakdown per event
router.get('/dashboard', authenticateToken, requireRole('ORGANISER', 'ADMIN'), (req, res) => {
  let showsQuery = 'SELECT s.*, v.name as venue_name FROM shows s JOIN venues v ON s.venue_id = v.id';
  const params = [];

  if (req.user.role === 'ORGANISER') {
    showsQuery += ' WHERE s.organiser_id = ?';
    params.push(req.user.id);
  }

  showsQuery += ' ORDER BY s.start_time DESC';

  const shows = db.prepare(showsQuery).all(...params);

  const eventSummaries = shows.map(show => {
    // Total seats
    const totalSeats = db.prepare('SELECT COUNT(*) as count FROM show_seats WHERE show_id = ?').get(show.id).count;
    
    // Status breakdown
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM show_seats
      WHERE show_id = ?
      GROUP BY status
    `).all(show.id);

    const statusMap = { AVAILABLE: 0, HELD: 0, OFFERED: 0, BOOKED: 0 };
    counts.forEach(c => { statusMap[c.status] = c.count; });

    // Confirmed bookings & revenue
    const revenueStat = db.prepare(`
      SELECT COUNT(*) as bookings_count, COALESCE(SUM(total_amount), 0) as total_revenue
      FROM bookings
      WHERE show_id = ? AND status = 'CONFIRMED'
    `).get(show.id);

    // Waitlist count
    const waitlistCount = db.prepare(`
      SELECT COUNT(*) as count FROM waitlist WHERE show_id = ? AND status = 'WAITING'
    `).get(show.id).count;

    // Revenue per category
    const categoryRevenue = db.prepare(`
      SELECT bs.category, COUNT(bs.id) as count, COALESCE(SUM(bs.price), 0) as revenue
      FROM booking_seats bs
      JOIN bookings b ON bs.booking_id = b.id
      WHERE b.show_id = ? AND b.status = 'CONFIRMED'
      GROUP BY bs.category
    `).all(show.id);

    const occupancyRate = totalSeats > 0 ? ((statusMap.BOOKED / totalSeats) * 100).toFixed(1) : 0;

    return {
      show_id: show.id,
      title: show.title,
      category_type: show.category_type,
      start_time: show.start_time,
      venue_name: show.venue_name,
      total_seats: totalSeats,
      seats_available: statusMap.AVAILABLE,
      seats_held: statusMap.HELD,
      seats_offered: statusMap.OFFERED,
      seats_booked: statusMap.BOOKED,
      occupancy_rate_percent: Number(occupancyRate),
      total_bookings: revenueStat ? revenueStat.bookings_count : 0,
      total_revenue: revenueStat ? revenueStat.total_revenue : 0,
      waitlist_count: waitlistCount,
      category_revenue: categoryRevenue
    };
  });

  // Overall totals across all organiser's events
  const overallRevenue = eventSummaries.reduce((acc, curr) => acc + curr.total_revenue, 0);
  const overallBookings = eventSummaries.reduce((acc, curr) => acc + curr.total_bookings, 0);

  return res.json({
    summary: {
      total_events: eventSummaries.length,
      overall_revenue: overallRevenue,
      overall_bookings: overallBookings
    },
    events: eventSummaries
  });
});

export default router;
