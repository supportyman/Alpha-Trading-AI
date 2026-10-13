'use client';

import type { Candle } from '@/lib/types';

interface CandleChartProps {
  candles: Candle[];
  height?: number;
  showVolume?: boolean;
}

export function CandleChart({ candles, height = 320, showVolume = true }: CandleChartProps) {
  if (candles.length === 0) return null;
  const width = 800;
  const padding = { top: 16, right: 56, bottom: showVolume ? 48 : 24, left: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const volH = showVolume ? 40 : 0;

  const prices = candles.flatMap((c) => [c.high, c.low]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const candleW = chartW / candles.length;
  const bodyW = Math.max(2, candleW * 0.6);

  const y = (price: number) => padding.top + chartH - ((price - min) / range) * chartH;
  const maxVol = Math.max(...candles.map((c) => c.volume));

  const gridLines = 5;
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => min + (range * i) / gridLines);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {/* Grid */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            x2={padding.left + chartW}
            y1={y(v)}
            y2={y(v)}
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
          <text
            x={padding.left + chartW + 6}
            y={y(v) + 3}
            fill="hsl(var(--muted-foreground))"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            {v >= 1000 ? v.toFixed(0) : v.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Candles */}
      {candles.map((c, i) => {
        const cx = padding.left + i * candleW + candleW / 2;
        const isUp = c.close >= c.open;
        const color = isUp ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBottom = y(Math.min(c.open, c.close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);
        return (
          <g key={i}>
            <line
              x1={cx}
              x2={cx}
              y1={y(c.high)}
              y2={y(c.low)}
              stroke={color}
              strokeWidth="1"
            />
            <rect
              x={cx - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={bodyHeight}
              fill={color}
              rx="0.5"
            />
            {showVolume && (
              <rect
                x={cx - bodyW / 2}
                y={height - padding.bottom + 4 + (1 - c.volume / maxVol) * (volH - 8)}
                width={bodyW}
                height={Math.max(1, (c.volume / maxVol) * (volH - 8))}
                fill={color}
                opacity="0.35"
                rx="0.5"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
