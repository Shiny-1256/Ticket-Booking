import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, MapPin, Ticket, Sparkles, Filter } from 'lucide-react';
import { apiRequest } from '../api/client.js';

const CATEGORIES = ['ALL', 'MOVIE', 'CONCERT', 'THEATRE', 'SPORTS'];

export default function EventList() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchShows = async () => {
    setLoading(true);
    try {
      let query = `?category_type=${selectedCategory}`;
      if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;
      const data = await apiRequest(`/shows${query}`);
      setShows(data.shows || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchShows();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 sm:p-12 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Real-Time Ticket Engine & Automated Waitlist</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Book Next-Gen Events With <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Zero Wastage</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Select seats on an interactive live grid. Built-in concurrency locking prevents double booking. Automatic waitlist reallocation ensures sold-out tickets never go to waste!
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search movies, concerts, or venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Filter Category Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        <Filter className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Event Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 bg-slate-900/50 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : shows.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-slate-800 rounded-2xl">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-300">No events found</h3>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or selected filter category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shows.map((show) => {
            const minPrice = Math.min(...Object.values(show.pricing || { default: 0 }));

            return (
              <div
                key={show.id}
                className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden flex flex-col transition hover:shadow-2xl hover:shadow-indigo-500/10"
              >
                {/* Event Image Banner */}
                <div className="relative h-48 overflow-hidden bg-slate-950">
                  <img
                    src={show.banner_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80'}
                    alt={show.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                  {/* Category Type Badge */}
                  <div className="absolute top-3 left-3 px-3 py-1 bg-slate-950/80 backdrop-blur-md border border-slate-700 rounded-lg text-[10px] font-extrabold uppercase tracking-wider text-sky-400">
                    {show.category_type}
                  </div>

                  {/* Availability Badge */}
                  <div className="absolute top-3 right-3">
                    {show.is_sold_out ? (
                      <span className="px-3 py-1 bg-rose-500/90 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg animate-pulse">
                        SOLD OUT
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-500/90 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg">
                        {show.available_seats} SEATS LEFT
                      </span>
                    )}
                  </div>
                </div>

                {/* Event Info */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition line-clamp-1">
                      {show.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {show.description}
                    </p>

                    <div className="pt-2 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center space-x-2 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{new Date(show.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-sky-400" />
                        <span>{show.venue_name} ({show.venue_city})</span>
                      </div>
                    </div>
                  </div>

                  {/* Action & Price Footer */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Starts From</span>
                      <span className="text-lg font-black text-white">${minPrice}</span>
                    </div>

                    <Link
                      to={`/events/${show.id}`}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
                        show.is_sold_out
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                      }`}
                    >
                      {show.is_sold_out ? 'Join Waitlist ⚡' : 'Select Seats 🎟️'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
