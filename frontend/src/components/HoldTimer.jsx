import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function HoldTimer({ heldUntil, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!heldUntil) return;

    const calculateTime = () => {
      const diff = Math.max(0, Math.floor((new Date(heldUntil).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff === 0 && onExpired) {
        onExpired();
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [heldUntil, onExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 120; // less than 2 minutes

  return (
    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono ${
      isUrgent
        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    }`}>
      {isUrgent ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <Clock className="w-3.5 h-3.5" />}
      <span>
        Hold Expires: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
