import express from 'express';
import db from '../db/db.js';

const router = express.Router();

// Get recent email logs for debugging/demo inspection
router.get('/', (req, res) => {
  const logs = db.prepare(`
    SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 50
  `).all();
  return res.json({ emailLogs: logs });
});

export default router;
