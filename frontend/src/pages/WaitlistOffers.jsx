import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sparkles, Clock, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../api/client.js';

export default function WaitlistOffers() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenParam = searchParams.get('token');

  const [waitlists, setWaitlists] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimToken, setClaimToken] = useState(tokenParam || '');
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/waitlist/my-status');
      setWaitlists(data.waitlists || []);
      setOffers(data.activeOffers || []);
    } catch (err) {
      console.error('Failed to load waitlist status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleClaimOffer = async (offer) => {
    setClaiming(true);
    setMessage(null);
    try {
      const data = await apiRequest('/bookings/confirm', {
        method: 'POST',
        body: JSON.stringify({
          showId: offer.show_id,
          seatIds: [offer.show_seat_id],
          offerToken: offer.offer_token
        })
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setMessage({ type: 'success', text: `Seat ${offer.seat_label} successfully claimed and booked!` });
      fetchStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to claim offer' });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center space-x-3">
            <Sparkles className="w-7 h-7 text-amber-400" />
            <span>Waitlist & Time-Limited Seat Offers</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated seat reallocation system - when cancellations occur, offered seats have a time limit before advancing to next in queue
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Active Offers Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Active Time-Limited Offers</span>
        </h2>

        {offers.length === 0 ? (
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500 text-center">
            No active seat offers pending. If a seat opens up for your waitlisted events, an offer will appear here!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {offers.map((offer) => {
              const expiresDate = new Date(offer.expires_at);

              return (
                <div
                  key={offer.id}
                  className="bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/40 rounded-3xl p-6 space-y-4 shadow-2xl shadow-amber-500/10 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase rounded-lg">
                        SPECIAL SEAT OFFER
                      </span>
                      <h3 className="text-lg font-bold text-white mt-2">{offer.show_title}</h3>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Offered Seat:</span>
                      <span className="font-bold text-white">{offer.seat_label} ({offer.category})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price:</span>
                      <span className="font-bold text-emerald-400">${offer.price}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-rose-400 font-semibold">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Expires At:</span>
                      </span>
                      <span>{expiresDate.toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleClaimOffer(offer)}
                    disabled={claiming}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-amber-500/30 transition flex items-center justify-center space-x-2"
                  >
                    <span>{claiming ? 'Processing Claim...' : 'Claim & Book Seat Now 🎟️'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Waitlists Queue Section */}
      <div className="space-y-4 pt-6 border-t border-slate-800">
        <h2 className="text-lg font-bold text-white">Your Waitlist Subscriptions</h2>

        {waitlists.length === 0 ? (
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500 text-center">
            You are not currently queued on any waitlists.
          </div>
        ) : (
          <div className="space-y-3">
            {waitlists.map((w) => (
              <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-white text-sm">{w.show_title}</h4>
                  <span className="text-slate-400 text-[11px] block mt-0.5">Category: <strong className="text-sky-400">{w.category}</strong></span>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                    w.status === 'OFFERED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {w.status === 'OFFERED' ? 'OFFER PENDING' : 'WAITING IN QUEUE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
