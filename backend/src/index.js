import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { initDatabase } from './db/db.js';
import { startTtlWorker } from './jobs/ttlWorker.js';

import authRoutes from './routes/authRoutes.js';
import venueRoutes from './routes/venueRoutes.js';
import showRoutes from './routes/showRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';
import organiserRoutes from './routes/organiserRoutes.js';
import emailRoutes from './routes/emailRoutes.js';

dotenv.config();

// Initialize SQLite schema
initDatabase();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

app.set('io', io);

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/organiser', organiserRoutes);
app.use('/api/emails', emailRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Socket.IO real-time seat map subscriptions
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('joinShow', (showId) => {
    socket.join(`show:${showId}`);
    console.log(`[Socket.io] Socket ${socket.id} joined room: show:${showId}`);
  });

  socket.on('leaveShow', (showId) => {
    socket.leave(`show:${showId}`);
    console.log(`[Socket.io] Socket ${socket.id} left room: show:${showId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Start background TTL Auto-Release Worker (polls every 5 seconds)
startTtlWorker(io, 5000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CinePass Ticket Booking Server running on port ${PORT}`);
  console.log(`====================================================`);
});
