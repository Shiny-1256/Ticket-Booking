import express from 'express';
import crypto from 'crypto';
import db from '../db/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// List shows with filtering (category, search, city, date)
router.get('/', (req, res) => {
  const { category_type, search, city } = req.query;

  let query = `
    SELECT s.*, v.name as venue_name, v.city as venue_city, u.name as organiser_name
    FROM shows s
    JOIN venues v ON s.venue_id = v.id
    JOIN users u ON s.organiser_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (category_type && category_type !== 'ALL') {
    query += ` AND s.category_type = ?`;
    params.push(category_type);
  }

  if (city) {
    query += ` AND v.city = ?`;
    params.push(city);
  }

  if (search) {
    query += ` AND (s.title LIKE ? OR s.description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY s.start_time ASC`;

  const shows = db.prepare(query).all(...params);

  // Compute available seats count per show
  const showsWithStats = shows.map(show => {
    const seatStats = db.prepare(`
      SELECT 
        COUNT(*) as total_seats,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_seats
      FROM show_seats
      WHERE show_id = ?
    `).get(show.id);

    return {
      ...show,
      pricing: JSON.parse(show.pricing_json),
      total_seats: seatStats ? seatStats.total_seats : 0,
      available_seats: seatStats ? seatStats.available_seats : 0,
      is_sold_out: seatStats ? seatStats.available_seats === 0 : false
    };
  });

  return res.json({ shows: showsWithStats });
});

// Get single show details + seat map
router.get('/:id', (req, res) => {
  const show = db.prepare(`
    SELECT s.*, v.name as venue_name, v.city as venue_city, v.rows_count, v.cols_count, v.layout_json
    FROM shows s
    JOIN venues v ON s.venue_id = v.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!show) return res.status(404).json({ error: 'Show not found' });

  // Get seats for this show
  const seats = db.prepare(`
    SELECT id, seat_label, row_name, col_num, category, price, status, held_by_user_id, held_until
    FROM show_seats
    WHERE show_id = ?
    ORDER BY row_name ASC, col_num ASC
  `).all(show.id);

  // Category breakdown stats
  const categoryStats = db.prepare(`
    SELECT category, 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available
    FROM show_seats
    WHERE show_id = ?
    GROUP BY category
  `).all(show.id);

  return res.json({
    show: {
      ...show,
      pricing: JSON.parse(show.pricing_json),
      venue_layout: JSON.parse(show.layout_json)
    },
    seats,
    categoryStats
  });
});

// Organiser / Admin create show
router.post('/', authenticateToken, requireRole('ORGANISER', 'ADMIN'), (req, res) => {
  try {
    const { title, description, category_type, banner_url, venue_id, start_time, end_time, pricing } = req.body;

    if (!title || !category_type || !venue_id || !start_time || !end_time || !pricing) {
      return res.status(400).json({ error: 'Missing required event fields' });
    }

    const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(venue_id);
    if (!venue) return res.status(404).json({ error: 'Selected venue does not exist' });

    const showId = crypto.randomUUID();
    const organiserId = req.user.id;
    const pricingJson = JSON.stringify(pricing);

    const createShowTx = db.transaction(() => {
      // 1. Insert Show record
      db.prepare(`
        INSERT INTO shows (id, title, description, category_type, banner_url, venue_id, organiser_id, start_time, end_time, pricing_json, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPCOMING', CURRENT_TIMESTAMP)
      `).run(showId, title, description || '', category_type, banner_url || '', venue_id, organiserId, start_time, end_time, pricingJson);

      // 2. Build seats map based on venue layout
      const layout = JSON.parse(venue.layout_json);
      const rowNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      const insertSeatStmt = db.prepare(`
        INSERT INTO show_seats (id, show_id, seat_label, row_name, col_num, category, price, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', CURRENT_TIMESTAMP)
      `);

      for (let r = 0; r < venue.rows_count; r++) {
        const rowName = rowNames[r] || `R${r + 1}`;
        const rowCategoryConfig = layout.rowCategories && layout.rowCategories[r] 
          ? layout.rowCategories[r] 
          : 'Standard';

        for (let c = 1; c <= venue.cols_count; c++) {
          const seatLabel = `${rowName}${c}`;
          const seatCategory = rowCategoryConfig;
          const seatPrice = pricing[seatCategory] !== undefined ? Number(pricing[seatCategory]) : 50;

          insertSeatStmt.run(crypto.randomUUID(), showId, seatLabel, rowName, c, seatCategory, seatPrice);
        }
      }
    });

    createShowTx();

    const createdShow = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
    return res.status(201).json({
      message: 'Show listing created successfully with generated seat map',
      show: {
        ...createdShow,
        pricing: JSON.parse(createdShow.pricing_json)
      }
    });
  } catch (err) {
    console.error('Create show error:', err);
    return res.status(500).json({ error: 'Failed to create show listing' });
  }
});

// Organiser / Admin update show status (e.g. Cancel show)
router.patch('/:id/status', authenticateToken, requireRole('ORGANISER', 'ADMIN'), (req, res) => {
  const { status } = req.body;
  const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(req.params.id);
  if (!show) return res.status(404).json({ error: 'Show not found' });

  if (req.user.role === 'ORGANISER' && show.organiser_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own shows' });
  }

  db.prepare('UPDATE shows SET status = ? WHERE id = ?').run(status, req.params.id);
  return res.json({ message: `Show status updated to ${status}` });
});

export default router;
