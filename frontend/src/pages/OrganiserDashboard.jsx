import React, { useState, useEffect } from 'react';
import { BarChart3, Plus, DollarSign, Users, Ticket, Film, Calendar, Check, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api/client.js';

export default function OrganiserDashboard() {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingShow, setIsCreatingShow] = useState(false);

  // New Show Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryType, setCategoryType] = useState('MOVIE');
  const [bannerUrl, setBannerUrl] = useState('');
  const [venueId, setVenueId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Per category pricing state
  const [vipPrice, setVipPrice] = useState(120);
  const [premiumPrice, setPremiumPrice] = useState(80);
  const [standardPrice, setStandardPrice] = useState(45);
  const [frontRowPrice, setFrontRowPrice] = useState(200);

  const [message, setMessage] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/organiser/dashboard');
      setSummary(data.summary);
      setEvents(data.events || []);

      const vData = await apiRequest('/venues');
      setVenues(vData.venues || []);
      if (vData.venues && vData.venues.length > 0 && !venueId) {
        setVenueId(vData.venues[0].id);
      }
    } catch (err) {
      console.error('Failed to load organiser dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCreateShow = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      const pricing = {
        FrontRow: Number(frontRowPrice),
        VIP: Number(vipPrice),
        Premium: Number(premiumPrice),
        Standard: Number(standardPrice)
      };

      await apiRequest('/shows', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          category_type: categoryType,
          banner_url: bannerUrl,
          venue_id: venueId,
          start_time: startTime,
          end_time: endTime,
          pricing
        })
      });

      setMessage({ type: 'success', text: 'Show listing created with generated seat map!' });
      setIsCreatingShow(false);
      setTitle('');
      setDescription('');
      fetchDashboard();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to create show listing' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center space-x-3">
            <BarChart3 className="w-7 h-7 text-indigo-400" />
            <span>Organiser Dashboard & Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track ticket sales, revenue per category, occupancy rates, and publish new events</p>
        </div>
        <button
          onClick={() => setIsCreatingShow(!isCreatingShow)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreatingShow ? 'Cancel' : 'Publish New Event'}</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Top Stat Overview Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center space-x-4 shadow-xl">
            <div className="p-3.5 bg-indigo-500/20 text-indigo-400 rounded-2xl">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Listings</span>
              <h3 className="text-2xl font-black text-white mt-0.5">{summary.total_events}</h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center space-x-4 shadow-xl">
            <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-2xl">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmed Bookings</span>
              <h3 className="text-2xl font-black text-white mt-0.5">{summary.overall_bookings}</h3>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center space-x-4 shadow-xl">
            <div className="p-3.5 bg-sky-500/20 text-sky-400 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue Generated</span>
              <h3 className="text-2xl font-black text-emerald-400 mt-0.5">${summary.overall_revenue.toFixed(2)}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Form */}
      {isCreatingShow && (
        <form onSubmit={handleCreateShow} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Create Event Listing</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Event Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Wicked Movie IMAX Premiere"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Category Type</label>
              <select
                value={categoryType}
                onChange={(e) => setCategoryType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              >
                <option value="MOVIE">MOVIE</option>
                <option value="CONCERT">CONCERT</option>
                <option value="THEATRE">THEATRE</option>
                <option value="SPORTS">SPORTS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1.5">Description</label>
            <textarea
              rows="2"
              placeholder="Event summary and highlight details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Select Venue</label>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.city} - {v.total_capacity} seats)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Start Time</label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">End Time</label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
          </div>

          {/* Pricing Per Category */}
          <div className="pt-2 space-y-3">
            <h4 className="text-xs font-bold text-slate-300">Set Per-Category Seat Pricing ($)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] font-bold text-emerald-400 block mb-1">FrontRow Price</label>
                <input
                  type="number"
                  value={frontRowPrice}
                  onChange={(e) => setFrontRowPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-amber-400 block mb-1">VIP Price</label>
                <input
                  type="number"
                  value={vipPrice}
                  onChange={(e) => setVipPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-sky-400 block mb-1">Premium Price</label>
                <input
                  type="number"
                  value={premiumPrice}
                  onChange={(e) => setPremiumPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Standard Price</label>
                <input
                  type="number"
                  value={standardPrice}
                  onChange={(e) => setStandardPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition"
          >
            Publish Event & Generate Seats
          </button>
        </form>
      )}

      {/* Per-Event Breakdown Tables */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-white">Event Performance Breakdown</h2>

        <div className="space-y-6">
          {events.map((e) => (
            <div key={e.show_id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="px-2.5 py-0.5 bg-sky-500/20 text-sky-300 text-[10px] font-extrabold uppercase rounded">
                    {e.category_type}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">{e.title}</h3>
                  <span className="text-xs text-slate-400">{e.venue_name} | {new Date(e.start_time).toLocaleString()}</span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Event Revenue</span>
                  <span className="text-xl font-black text-emerald-400">${e.total_revenue.toFixed(2)}</span>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Occupancy Rate</span>
                  <strong className="text-sky-400 text-base">{e.occupancy_rate_percent}%</strong>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Booked Seats</span>
                  <strong className="text-emerald-400 text-base">{e.seats_booked} / {e.total_seats}</strong>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Held (In Cart)</span>
                  <strong className="text-amber-400 text-base">{e.seats_held}</strong>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Available Seats</span>
                  <strong className="text-slate-300 text-base">{e.seats_available}</strong>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Waitlist Queue</span>
                  <strong className="text-amber-300 text-base">{e.waitlist_count}</strong>
                </div>
              </div>

              {/* Category Revenue Table */}
              {e.category_revenue.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Category Sales Breakdown</h4>
                  <div className="flex flex-wrap gap-3">
                    {e.category_revenue.map(cr => (
                      <span key={cr.category} className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                        <strong className="text-slate-200">{cr.category}:</strong> {cr.count} tickets (${cr.revenue})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
