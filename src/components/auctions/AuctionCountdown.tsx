'use client';

import { useState, useEffect } from 'react';
import { Timer } from '@phosphor-icons/react/ssr';

interface AuctionCountdownProps {
  endAt: string;
  size?: 'sm' | 'lg';
  /** Render in white text for use on dark image overlays */
  overlay?: boolean;
  className?: string;
}

const ONE_HOUR = 3600;
const TWELVE_HOURS = 43200;
const FIVE_MINUTES = 300;

export function AuctionCountdown({ endAt, size = 'sm', overlay = false, className = '' }: AuctionCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endAt));

  // Only flips once (when crossing the 1-hour mark), so the interval
  // is created at most twice: once at mount, once at the threshold.
  const isShortInterval = timeLeft.totalSeconds <= ONE_HOUR && timeLeft.totalSeconds > 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(endAt));
    }, isShortInterval ? 1000 : 60000);

    return () => clearInterval(interval);
  }, [endAt, isShortInterval]);

  if (timeLeft.totalSeconds <= 0) {
    const endedClass = overlay ? 'text-snow-white' : 'text-semantic-text-muted';
    return <span className={`${endedClass} ${sizeClass(size)} ${className}`}>Ended</span>;
  }

  const tier = getUrgencyTier(timeLeft.totalSeconds);
  const colorClass = overlay ? 'text-snow-white font-medium' : tierClass(tier);

  return (
    <span className={`inline-flex items-center gap-1.5 ${colorClass} ${sizeClass(size)} tabular-nums ${className}`}>
      {!overlay && <Timer size={size === 'lg' ? 20 : 14} weight={tier === 'normal' ? 'regular' : 'bold'} />}
      {!overlay && tier === 'critical' && 'Ending soon — '}
      {formatTimeLeft(timeLeft)}
    </span>
  );
}

type UrgencyTier = 'normal' | 'warning' | 'critical';

function getUrgencyTier(totalSeconds: number): UrgencyTier {
  if (totalSeconds <= FIVE_MINUTES) return 'critical';
  if (totalSeconds <= TWELVE_HOURS) return 'warning';
  return 'normal';
}

function tierClass(tier: UrgencyTier): string {
  switch (tier) {
    case 'critical': return 'text-aurora-red font-bold animate-pulse';
    case 'warning': return 'text-aurora-orange font-semibold';
    case 'normal': return 'text-semantic-text-secondary';
  }
}

function sizeClass(size: 'sm' | 'lg'): string {
  // Only controls text size — font weight is owned by tierClass (or colorClass in overlay mode)
  return size === 'lg' ? 'text-lg' : 'text-sm';
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
