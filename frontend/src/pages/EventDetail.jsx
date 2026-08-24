import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Ticket, AlertCircle, ShieldAlert, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest, getSocket } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import SeatMap from '../components/SeatMap.jsx';
import HoldTimer from '../components/HoldTimer.jsx';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [show, setShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected seats state
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [isHolding, setIsHolding] = useState(false);
  const [heldUntil, setHeldUntil] = useState(null);
  const [holdId, setHoldId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [waitlistCategory, setWaitlistCategory] = useState('');
  const [waitlistSuccess, setWaitlistSuccess] = useState(null);

  const fetchShowDetails = async () => {
    try {
      const data = await apiRequest(`/shows/${id}`);
      setShow(data.show);
      setSeats(data.seats || []);
      setCategoryStats(data.categoryStats || []);

      // Check if user already holds seats for this show
      const myHolds = data.seats.filter(s => s.status === 'HELD' && s.held_by_user_id === user?.id);
      if (myHolds.length > 0) {
        setSelectedSeats(myHolds);
        setIsHolding(true);
        setHeldUntil(myHolds[0].held_until);
      }
    } catch (err) {
      console.error('Failed to load event:', err);
      setErrorMsg('Failed to load event details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShowDetails();

    // Socket.IO real-time seat status synchronization
    const socket = getSocket();
    socket.emit('joinShow', id);

    const handleSeatUpdate = ({ seatId, status, heldByUserId, heldUntil }) => {
      setSeats(prevSeats => prevSeats.map(s => {
        if (s.id === seatId) {
          return {
            ...s,
            status,
            held_by_user_id: heldByUserId !== undefined ? heldByUserId : s.held_by_user_id,
            held_until: heldUntil !== undefined ? heldUntil : s.held_until
          };
        }
        return s;
      }));
    };

    socket.on('seatStatusUpdated', handleSeatUpdate);

    return () => {
      socket.emit('leaveShow', id);
      socket.off('seatStatusUpdated', handleSeatUpdate);
    };
  }, [id, user]);

  const handleSeatClick = (seat) => {
    setErrorMsg(null);
    if (!user) {
      navigate('/login');
      return;
    }

    if (isHolding) {
      setErrorMsg('You already have held seats in checkout. Abandon current hold to re-select.');
      return;
    }

    const exists = selectedSeats.some(s => s.id === seat.id);
    if (exists) {
      setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
    } else {
      setSelectedSeats(prev => [...prev, seat]);
    }
  };

  const handleHoldSeats = async () => {
    if (selectedSeats.length === 0) return;
    setErrorMsg(null);
    try {
      const data = await apiRequest('/bookings/hold', {
        method: 'POST',
        body: JSON.stringify({
          showId: id,
          seatIds: selectedSeats.map(s => s.id)
        })
      });

      setIsHolding(true);
      setHeldUntil(data.heldUntil);
      setHoldId(data.holdId);
    } catch (err) {
      setErrorMsg(err.message);
      fetchShowDetails(); // Refresh map on conflict
    }
  };

  const handleAbandonHold = async () => {
    if (selectedSeats.length === 0) return;
    try {
      await apiRequest('/bookings/release', {
        method: 'POST',
        body: JSON.stringify({
          showId: id,
          seatIds: selectedSeats.map(s => s.id)
        })
      });
    } catch (err) {
      console.warn('Abandon hold error:', err.message);
    } finally {
      setIsHolding(false);
      setHeldUntil(null);
      setSelectedSeats([]);
    }
  };

  const handleConfirmBooking = async () => {
    if (selectedSeats.length === 0) return;
    setErrorMsg(null);
    try {
      const data = await apiRequest('/bookings/confirm', {
        method: 'POST',
        body: JSON.stringify({
          showId: id,
          seatIds: selectedSeats.map(s => s.id)
        })
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setBookingSuccess(data.booking);
      setIsHolding(false);
      setHeldUntil(null);
      setSelectedSeats([]);
      fetchShowDetails();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!waitlistCategory) return;
    try {
      const data = await apiRequest('/waitlist/join', {
        method: 'POST',
        body: JSON.stringify({
          showId: id,
          category: waitlistCategory
        })
      });
      setWaitlistSuccess(data);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading interactive seat map...</span>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        Event not found.
      </div>
    );
  }

  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Event Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-lg text-xs font-bold uppercase">
            <span>{show.category_type}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white">{show.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>{new Date(show.start_time).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-sky-400" />
              <span>{show.venue_name} ({show.venue_city})</span>
            </span>
          </div>
        </div>

        {/* Waitlist Callout if Sold Out */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {categoryStats.some(cs => cs.available === 0) && (
            <button
              onClick={() => {
                const soldOutCat = categoryStats.find(cs => cs.available === 0);
                if (soldOutCat) setWaitlistCategory(soldOutCat.category);
                setIsWaitlistModalOpen(true);
              }}
              className="px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-amber-600/30 flex items-center space-x-2 transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>Join Sold-Out Category Waitlist</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Seat Map & Checkout Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Visual Interactive Seat Map */}
        <div className="lg:col-span-2 space-y-4">
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {bookingSuccess && (
            <div className="p-6 bg-emerald-950/80 border border-emerald-500/50 rounded-3xl text-emerald-200 space-y-3">
              <div className="flex items-center space-x-3 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="text-lg font-bold">Booking Confirmed!</h3>
              </div>
              <p className="text-xs text-slate-300">
                Reference: <strong className="text-white bg-slate-900 px-2 py-1 rounded border border-slate-700">{bookingSuccess.bookingReference}</strong>
              </p>
              <p className="text-xs text-slate-300">An email ticket with QR code has been dispatched. Click "Email Outbox" in the navbar to preview your ticket!</p>
            </div>
          )}

          <SeatMap
            venueLayout={show.venue_layout}
            seats={seats}
            selectedSeatIds={selectedSeats.map(s => s.id)}
            currentUserId={user?.id}
            onSeatClick={handleSeatClick}
            categoryPricing={show.pricing}
          />
        </div>

        {/* Right Column: Hold & Checkout Drawer */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl sticky top-24">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <Ticket className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Your Seat Summary</h3>
              </div>
              {heldUntil && (
                <HoldTimer heldUntil={heldUntil} onExpired={handleAbandonHold} />
              )}
            </div>

            {selectedSeats.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <p>No seats selected yet.</p>
                <p className="text-slate-600">Click available seats on the map to place a hold.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedSeats.map(seat => (
                    <div key={seat.id} className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <span className="font-bold text-white">Seat {seat.seat_label}</span>
                        <span className="text-slate-400 block text-[10px]">{seat.category} Category</span>
                      </div>
                      <span className="font-bold text-emerald-400">${seat.price}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-400">Total Price:</span>
                  <span className="text-xl text-white">${totalPrice.toFixed(2)}</span>
                </div>

                {/* Actions */}
                {!isHolding ? (
                  <button
                    onClick={handleHoldSeats}
                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-amber-600/30 transition flex items-center justify-center space-x-2"
                  >
                    <span>Hold Seats (10 Min TTL Expiry)</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleConfirmBooking}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2"
                    >
                      <span>Pay & Confirm Booking 🎟️</span>
                    </button>
                    <button
                      onClick={handleAbandonHold}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-400 font-bold rounded-xl text-xs transition"
                    >
                      Abandon Hold & Release Seats
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Category Availability Breakdown */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Seat Category Status</h4>
              <div className="space-y-1.5">
                {categoryStats.map(cs => (
                  <div key={cs.category} className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">{cs.category}</span>
                    {cs.available === 0 ? (
                      <span className="text-rose-400 font-bold text-[10px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        SOLD OUT (Waitlist Available)
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold">{cs.available} of {cs.total} available</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Waitlist Modal */}
      {isWaitlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-750 max-w-md w-full rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>Join Category Waitlist</span>
              </h3>
              <button onClick={() => setIsWaitlistModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {waitlistSuccess ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white">Joined Waitlist!</h4>
                <p className="text-xs text-slate-400">
                  Your queue position is <strong className="text-amber-400">#{waitlistSuccess.queuePosition}</strong>.
                  If a cancellation occurs, you will receive a time-limited seat offer via email!
                </p>
                <button
                  onClick={() => setIsWaitlistModalOpen(false)}
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-2xl text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-300">
                  Select a seat category to join the priority waitlist for <strong className="text-indigo-400">{show.title}</strong>.
                </p>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-2">Category</label>
                  <select
                    value={waitlistCategory}
                    onChange={(e) => setWaitlistCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
                  >
                    {categoryStats.map(cs => (
                      <option key={cs.category} value={cs.category}>
                        {cs.category} ({cs.available === 0 ? 'SOLD OUT' : `${cs.available} available`})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleJoinWaitlist}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-amber-600/30 transition"
                >
                  Confirm & Join Queue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
