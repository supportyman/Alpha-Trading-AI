'use client';

import { cn } from '@/lib/utils';

interface ConfidenceRingProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}

export function ConfidenceRing({
  value,
  size = 72,
  stroke = 6,
  label,
}: ConfidenceRingProps) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  const color =
    value >= 85 ? 'hsl(var(--success))' : value >= 70 ? 'hsl(var(--primary))' : 'hsl(var(--warning))';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-sm font-bold')} style={{ color }}>
          {value}%
        </span>
        {label && <span className="text-[9px] uppercase text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
