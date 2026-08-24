import React from 'react';
import { Check, Lock, Clock, Sparkles } from 'lucide-react';

const CATEGORY_COLORS = {
  FrontRow: { bg: 'bg-emerald-950/40', border: 'border-emerald-500/40', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  VIP: { bg: 'bg-amber-950/40', border: 'border-amber-500/40', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
  Premium: { bg: 'bg-sky-950/40', border: 'border-sky-500/40', text: 'text-sky-400', badge: 'bg-sky-500/20 text-sky-300' },
  Standard: { bg: 'bg-slate-900', border: 'border-slate-700', text: 'text-slate-300', badge: 'bg-slate-800 text-slate-300' }
};

export default function SeatMap({
  venueLayout,
  seats = [],
  selectedSeatIds = [],
  currentUserId,
  onSeatClick,
  categoryPricing = {}
}) {
  const { rows_count = 8, cols_count = 12 } = venueLayout || {};
  const rowNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const aisleColumns = venueLayout?.layout?.aisleColumns || [];

  // Group seats by rowName
  const seatsByRow = {};
  seats.forEach(s => {
    if (!seatsByRow[s.row_name]) {
      seatsByRow[s.row_name] = [];
    }
    seatsByRow[s.row_name].push(s);
  });

  // Sort seats in row by col_num
  Object.keys(seatsByRow).forEach(r => {
    seatsByRow[r].sort((a, b) => a.col_num - b.col_num);
  });

  return (
    <div className="w-full flex flex-col items-center bg-slate-950/80 p-6 rounded-2xl border border-slate-800 shadow-2xl">
      {/* Curved Screen Banner */}
      <div className="w-full max-w-2xl mb-8 flex flex-col items-center">
        <div className="w-full h-3 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 rounded-full shadow-[0_0_25px_rgba(99,102,241,0.5)] transform -skew-x-12 opacity-90" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-2">
          🎬 STAGE / CINEMA SCREEN
        </span>
      </div>

      {/* Grid Seats Layout */}
      <div className="overflow-x-auto max-w-full pb-4 scrollbar-thin">
        <div className="flex flex-col space-y-3 min-w-max">
          {Array.from({ length: rows_count }).map((_, rIdx) => {
            const rName = rowNames[rIdx] || `R${rIdx + 1}`;
            const rowSeats = seatsByRow[rName] || [];

            return (
              <div key={rName} className="flex items-center space-x-2">
                {/* Row Label Left */}
                <div className="w-6 text-center text-xs font-bold text-slate-500">
                  {rName}
                </div>

                {/* Seats in Row */}
                <div className="flex items-center space-x-2">
                  {Array.from({ length: cols_count }).map((_, cIdx) => {
                    const colNum = cIdx + 1;
                    const seat = rowSeats.find(s => s.col_num === colNum);
                    const isAisle = aisleColumns.includes(colNum);

                    if (!seat) {
                      return (
                        <React.Fragment key={`empty-${rName}-${colNum}`}>
                          <div className="w-9 h-9 border border-dashed border-slate-800/40 rounded-lg opacity-20" />
                          {isAisle && <div className="w-6" />}
                        </React.Fragment>
                      );
                    }

                    const isSelected = selectedSeatIds.includes(seat.id);
                    const isMineHeld = seat.status === 'HELD' && seat.held_by_user_id === currentUserId;
                    const isOthersHeld = seat.status === 'HELD' && seat.held_by_user_id !== currentUserId;
                    const isOfferedToMe = seat.status === 'OFFERED' && seat.held_by_user_id === currentUserId;
                    const isOfferedToOther = seat.status === 'OFFERED' && seat.held_by_user_id !== currentUserId;
                    const isBooked = seat.status === 'BOOKED';
                    const isAvailable = seat.status === 'AVAILABLE';

                    const catTheme = CATEGORY_COLORS[seat.category] || CATEGORY_COLORS.Standard;

                    // Determine seat styling based on state
                    let seatClass = 'bg-slate-900 border-slate-750 text-slate-300 hover:border-indigo-500';
                    let icon = null;

                    if (isSelected) {
                      seatClass = 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.6)] scale-105';
                      icon = <Check className="w-4 h-4 stroke-[3]" />;
                    } else if (isMineHeld) {
                      seatClass = 'bg-amber-600 border-amber-400 text-white animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]';
                      icon = <Clock className="w-3.5 h-3.5" />;
                    } else if (isOfferedToMe) {
                      seatClass = 'bg-emerald-600 border-emerald-400 text-white animate-bounce shadow-[0_0_15px_rgba(16,185,129,0.7)]';
                      icon = <Sparkles className="w-3.5 h-3.5" />;
                    } else if (isOthersHeld || isOfferedToOther) {
                      seatClass = 'bg-amber-950/50 border-amber-800/40 text-amber-500/50 cursor-not-allowed opacity-60';
                      icon = <Clock className="w-3 h-3" />;
                    } else if (isBooked) {
                      seatClass = 'bg-slate-950 border-slate-900 text-slate-700 cursor-not-allowed opacity-40';
                      icon = <Lock className="w-3 h-3" />;
                    } else if (isAvailable) {
                      seatClass = `${catTheme.bg} ${catTheme.border} ${catTheme.text} hover:scale-105 transition-all`;
                    }

                    return (
                      <React.Fragment key={seat.id}>
                        <button
                          type="button"
                          disabled={isBooked || isOthersHeld || isOfferedToOther}
                          onClick={() => onSeatClick(seat)}
                          className={`w-9 h-9 rounded-xl border font-bold text-xs flex items-center justify-center transition-all ${seatClass}`}
                          title={`${seat.seat_label} (${seat.category}) - $${seat.price} | Status: ${seat.status}`}
                        >
                          {icon || seat.col_num}
                        </button>
                        {isAisle && <div className="w-6" />}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Row Label Right */}
                <div className="w-6 text-center text-xs font-bold text-slate-500">
                  {rName}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="w-full mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-slate-900 border border-slate-700" />
          <span>Available</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-indigo-600 border border-indigo-400 flex items-center justify-center text-white text-[10px]">✓</div>
          <span>Selected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-amber-600 border border-amber-400" />
          <span>Held (Your Cart)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-amber-950/60 border border-amber-800/50" />
          <span>Held by Others</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-slate-950 border border-slate-900 opacity-50" />
          <span>Booked / Reserved</span>
        </div>
      </div>

      {/* Category Price Tags */}
      {Object.keys(categoryPricing).length > 0 && (
        <div className="w-full mt-4 flex flex-wrap items-center justify-center gap-3">
          {Object.entries(categoryPricing).map(([cat, price]) => {
            const theme = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Standard;
            return (
              <span key={cat} className={`px-2.5 py-1 rounded-md text-xs font-medium border ${theme.badge}`}>
                {cat}: <strong className="ml-1">${price}</strong>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
