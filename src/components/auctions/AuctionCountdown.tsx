'use client';

import { useState, useEffect } from 'react';
import { Timer } from '@phosphor-icons/react/ssr';

interface AuctionCountdownProps {
  endAt: string;
  size?: 'sm' | 'lg';
  className?: string;
}

const TWELVE_HOURS = 43200;
const FIVE_MINUTES = 300;

export function AuctionCountdown({ endAt, size = 'sm', className = '' }: AuctionCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(endAt));
    }, timeLeft.totalSeconds <= TWELVE_HOURS ? 1000 : 60000);

    return () => clearInterval(interval);
  }, [endAt, timeLeft.totalSeconds]);

  if (timeLeft.totalSeconds <= 0) {
    return <span className={`text-semantic-text-muted ${sizeClass(size)} ${className}`}>Ended</span>;
  }

  const tier = getUrgencyTier(timeLeft.totalSeconds);

  return (
    <span className={`inline-flex items-center gap-1.5 ${tierClass(tier)} ${sizeClass(size)} tabular-nums ${className}`}>
      <Timer size={size === 'lg' ? 20 : 14} weight={tier === 'normal' ? 'regular' : 'bold'} />
      {tier === 'critical' && 'Ending soon — '}
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
  return size === 'lg' ? 'text-lg font-semibold' : 'text-sm';
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
