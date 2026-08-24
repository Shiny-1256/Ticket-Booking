import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Ticket, Film, Calendar, ShieldCheck, BarChart3, Mail, LogOut, User, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import EmailOutboxModal from './EmailOutboxModal.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Ticket className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Cine<span className="text-sky-400">Pass</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            <Link
              to="/"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                isActive('/') ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Film className="w-4 h-4" />
                <span>Events</span>
              </span>
            </Link>

            {user && (
              <>
                <Link
                  to="/my-bookings"
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                    isActive('/my-bookings') ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>My Bookings</span>
                  </span>
                </Link>

                <Link
                  to="/waitlist-offers"
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                    isActive('/waitlist-offers') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Waitlist & Offers</span>
                  </span>
                </Link>

                {(user.role === 'ADMIN' || user.role === 'ORGANISER') && (
                  <Link
                    to="/organiser"
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      isActive('/organiser') ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <BarChart3 className="w-4 h-4" />
                      <span>Organiser Dashboard</span>
                    </span>
                  </Link>
                )}

                {user.role === 'ADMIN' && (
                  <Link
                    to="/admin/venues"
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      isActive('/admin/venues') ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Admin Venues</span>
                    </span>
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-3">
            {/* Email Outbox Inspector Trigger */}
            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
              title="Inspect dispatched QR ticket emails and waitlist notifications"
            >
              <Mail className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Email Outbox</span>
            </button>

            {user ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden lg:block text-left">
                    <div className="text-xs font-bold text-slate-200">{user.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-sky-400 font-extrabold">{user.role}</div>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Email Outbox Inspector Modal */}
      <EmailOutboxModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </>
  );
}
