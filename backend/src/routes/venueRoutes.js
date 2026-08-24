import express from 'express';
import crypto from 'crypto';
import db from '../db/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public / Authenticated list venues
router.get('/', (req, res) => {
  const venues = db.prepare('SELECT * FROM venues ORDER BY name ASC').all();
  const parsed = venues.map(v => ({
    ...v,
    layout: JSON.parse(v.layout_json)
  }));
  return res.json({ venues: parsed });
});

router.get('/:id', (req, res) => {
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  return res.json({
    venue: {
      ...venue,
      layout: JSON.parse(venue.layout_json)
    }
  });
});

// Admin create venue with grid layout and seat categories
router.post('/', authenticateToken, requireRole('ADMIN'), (req, res) => {
  try {
    const { name, address, city, rows_count, cols_count, layout } = req.body;

    if (!name || !address || !city || !rows_count || !cols_count || !layout) {
      return res.status(400).json({ error: 'Name, address, city, rows_count, cols_count, and layout details are required' });
    }

    const venueId = crypto.randomUUID();
    const totalCapacity = rows_count * cols_count;
    const layoutJson = JSON.stringify(layout);

    db.prepare(`
      INSERT INTO venues (id, name, address, city, total_capacity, rows_count, cols_count, layout_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(venueId, name, address, city, totalCapacity, rows_count, cols_count, layoutJson);

    const created = db.prepare('SELECT * FROM venues WHERE id = ?').get(venueId);
    return res.status(201).json({
      message: 'Venue created successfully',
      venue: {
        ...created,
        layout: JSON.parse(created.layout_json)
      }
    });
  } catch (err) {
    console.error('Create venue error:', err);
    return res.status(500).json({ error: 'Failed to create venue' });
  }
});

// Admin delete venue
router.delete('/:id', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  db.prepare('DELETE FROM venues WHERE id = ?').run(req.params.id);
  return res.json({ message: 'Venue deleted successfully' });
});

export default router;
