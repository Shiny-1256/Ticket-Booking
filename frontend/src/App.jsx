import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import EventList from './pages/EventList.jsx';
import EventDetail from './pages/EventDetail.jsx';
import MyBookings from './pages/MyBookings.jsx';
import WaitlistOffers from './pages/WaitlistOffers.jsx';
import AdminVenues from './pages/AdminVenues.jsx';
import OrganiserDashboard from './pages/OrganiserDashboard.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Inter',sans-serif]">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<EventList />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/waitlist-offers" element={<WaitlistOffers />} />
              <Route path="/admin/venues" element={<AdminVenues />} />
              <Route path="/organiser" element={<OrganiserDashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Routes>
          </main>
          <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-slate-950">
            <p>© 2026 CinePass Ticket Booking Engine. All rights reserved.</p>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
