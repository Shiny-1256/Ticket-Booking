import React, { useState, useEffect } from 'react';
import { Ticket, Calendar, MapPin, QrCode, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client.js';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/bookings/my-bookings');
      setBookings(data.bookings || []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? Released seats will be auto-offered to waitlisted customers.')) {
      return;
    }

    setCancellingId(bookingId);
    setMessage(null);
    try {
      const data = await apiRequest('/bookings/cancel', {
        method: 'POST',
        body: JSON.stringify({ bookingId })
      });
      setMessage({ type: 'success', text: data.message || 'Booking cancelled successfully' });
      fetchBookings();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to cancel booking' });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center space-x-3">
            <Ticket className="w-7 h-7 text-indigo-400" />
            <span>My Bookings & QR Tickets</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage confirmed reservations, view entry QR codes, or cancel bookings</p>
        </div>
        <button
          onClick={fetchBookings}
          className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-slate-900/50 border border-slate-800 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-slate-800 rounded-3xl">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-300">No active bookings found</h3>
          <p className="text-xs text-slate-500 mt-1">Explore upcoming movies and concerts to book your first seat!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((b) => (
            <div
              key={b.id}
              className={`bg-slate-900 border ${
                b.status === 'CANCELLED' ? 'border-slate-850 opacity-60' : 'border-slate-800'
              } rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl`}
            >
              {/* Ticket Meta & Event Info */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-slate-950 border border-slate-800 text-sky-400 font-mono font-bold text-xs rounded-lg">
                    {b.booking_reference}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    b.status === 'CONFIRMED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {b.status}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white">{b.show_title}</h3>

                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>{new Date(b.start_time).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <MapPin className="w-4 h-4 text-sky-400" />
                    <span>{b.venue_name} ({b.city})</span>
                  </span>
                </div>

                {/* Seats list */}
                <div className="pt-2 flex flex-wrap gap-2">
                  {b.seats.map((seat) => (
                    <span key={seat.seat_label} className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200">
                      Seat <strong className="text-indigo-400">{seat.seat_label}</strong> ({seat.category}) - ${seat.price}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-slate-400 pt-1">
                  Total Paid: <strong className="text-emerald-400 text-sm font-bold ml-1">${b.total_amount.toFixed(2)}</strong>
                </div>
              </div>

              {/* QR Code & Actions */}
              <div className="flex flex-col items-center md:items-end space-y-4 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-800">
                {b.status === 'CONFIRMED' && b.qr_code_data && (
                  <div className="bg-white p-2.5 rounded-2xl shadow-lg border border-slate-700 flex flex-col items-center">
                    <img src={b.qr_code_data} alt="QR Code Ticket" className="w-28 h-28" />
                    <span className="text-[9px] font-bold text-slate-900 mt-1 uppercase tracking-wider">Scan Entry Pass</span>
                  </div>
                )}

                {b.status === 'CONFIRMED' && (
                  <button
                    onClick={() => handleCancelBooking(b.id)}
                    disabled={cancellingId === b.id}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{cancellingId === b.id ? 'Cancelling...' : 'Cancel Booking'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
