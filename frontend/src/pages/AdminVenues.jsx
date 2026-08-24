import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, MapPin, Grid, Layers, Check, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client.js';

export default function AdminVenues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Venue form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [rowsCount, setRowsCount] = useState(8);
  const [colsCount, setColsCount] = useState(12);
  const [aisleCols, setAisleCols] = useState('3, 9');
  const [rowCategories, setRowCategories] = useState({
    0: 'VIP',
    1: 'VIP',
    2: 'Premium',
    3: 'Premium',
    4: 'Premium',
    5: 'Standard',
    6: 'Standard',
    7: 'Standard'
  });

  const [message, setMessage] = useState(null);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/venues');
      setVenues(data.venues || []);
    } catch (err) {
      console.error('Failed to load venues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const handleRowCategoryChange = (rIdx, category) => {
    setRowCategories(prev => ({
      ...prev,
      [rIdx]: category
    }));
  };

  const handleCreateVenue = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      const parsedAisles = aisleCols.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const layout = {
        rowCategories,
        aisleColumns: parsedAisles
      };

      await apiRequest('/venues', {
        method: 'POST',
        body: JSON.stringify({
          name,
          address,
          city,
          rows_count: Number(rowsCount),
          cols_count: Number(colsCount),
          layout
        })
      });

      setMessage({ type: 'success', text: 'Venue created successfully!' });
      setIsCreating(false);
      setName('');
      setAddress('');
      setCity('');
      fetchVenues();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to create venue' });
    }
  };

  const handleDeleteVenue = async (venueId) => {
    if (!window.confirm('Delete this venue?')) return;
    try {
      await apiRequest(`/venues/${venueId}`, { method: 'DELETE' });
      fetchVenues();
    } catch (err) {
      alert(err.message);
    }
  };

  const rowNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center space-x-3">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            <span>Admin Venue & Seat Layout Manager</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Design venue seating grids, aisle breakdowns, and category mappings</p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreating ? 'Cancel Builder' : 'Create New Venue'}</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Venue Creator Form */}
      {isCreating && (
        <form onSubmit={handleCreateVenue} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Venue Configuration</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Venue Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Dolby Theatre Hall 2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Address</label>
              <input
                type="text"
                required
                placeholder="e.g. 6801 Hollywood Blvd"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">City</label>
              <input
                type="text"
                required
                placeholder="e.g. Los Angeles"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Total Rows (1 - 15)</label>
              <input
                type="number"
                min="1"
                max="15"
                value={rowsCount}
                onChange={(e) => setRowsCount(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Columns per Row (1 - 20)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={colsCount}
                onChange={(e) => setColsCount(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Aisle Gaps (comma separated cols)</label>
              <input
                type="text"
                placeholder="e.g. 3, 9"
                value={aisleCols}
                onChange={(e) => setAisleCols(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>
          </div>

          {/* Row Category Configurator */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-300">Assign Category Per Row</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: rowsCount }).map((_, rIdx) => {
                const rName = rowNames[rIdx] || `R${rIdx + 1}`;
                return (
                  <div key={rIdx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400">Row {rName}:</span>
                    <select
                      value={rowCategories[rIdx] || 'Standard'}
                      onChange={(e) => handleRowCategoryChange(rIdx, e.target.value)}
                      className="bg-slate-900 border border-slate-750 text-[11px] font-semibold text-white rounded-lg p-1"
                    >
                      <option value="FrontRow">FrontRow</option>
                      <option value="VIP">VIP</option>
                      <option value="Premium">Premium</option>
                      <option value="Standard">Standard</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-600/30 transition"
          >
            Save Venue Layout to Database
          </button>
        </form>
      )}

      {/* Existing Venues List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {venues.map((v) => (
          <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{v.name}</h3>
                <span className="text-xs text-slate-400 flex items-center space-x-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>{v.address}, {v.city}</span>
                </span>
              </div>
              <button
                onClick={() => handleDeleteVenue(v.id)}
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-around text-center text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Capacity</span>
                <span className="text-white font-bold text-base">{v.total_capacity} Seats</span>
              </div>
              <div className="border-r border-slate-800" />
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Grid Dimensions</span>
                <span className="text-white font-bold text-base">{v.rows_count} R x {v.cols_count} C</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
