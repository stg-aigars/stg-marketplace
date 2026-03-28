'use client';

import { useState, useEffect } from 'react';

interface AuctionCountdownProps {
  endAt: string;
  className?: string;
}

export function AuctionCountdown({ endAt, className = '' }: AuctionCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(endAt));
    }, timeLeft.totalSeconds <= 3600 ? 1000 : 60000);

    return () => clearInterval(interval);
  }, [endAt, timeLeft.totalSeconds]);

  if (timeLeft.totalSeconds <= 0) {
    return <span className={`text-semantic-text-muted ${className}`}>Ended</span>;
  }

  const isEndingSoon = timeLeft.totalSeconds <= 300; // 5 minutes

  return (
    <span className={`${isEndingSoon ? 'text-aurora-red font-medium' : 'text-semantic-text-muted'} ${className}`}>
      {isEndingSoon && 'Ending soon — '}
      {formatTimeLeft(timeLeft)}
    </span>
  );
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

function getTimeLeft(endAt: string): TimeLeft {
  const diff = Math.max(0, new Date(endAt).getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}

function formatTimeLeft(t: TimeLeft): string {
  if (t.days > 0) return `${t.days}d ${t.hours}h`;
  if (t.hours > 0) return `${t.hours}h ${t.minutes}m`;
  if (t.minutes > 0) return `${t.minutes}m ${t.seconds}s`;
  return `${t.seconds}s`;
}
