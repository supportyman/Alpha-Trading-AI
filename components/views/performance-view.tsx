'use client';

import { BarChart3, TrendingUp, Target, Percent, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MONTHLY = [
  { month: 'Feb', pnl: 4200, trades: 18 },
  { month: 'Mar', pnl: -1800, trades: 14 },
  { month: 'Apr', pnl: 6400, trades: 22 },
  { month: 'May', pnl: 3200, trades: 19 },
  { month: 'Jun', pnl: 8900, trades: 26 },
  { month: 'Jul', pnl: 5600, trades: 21 },
];

export function PerformanceView() {
  const maxPnl = Math.max(...MONTHLY.map((m) => Math.abs(m.pnl)));
  const totalPnl = MONTHLY.reduce((s, m) => s + m.pnl, 0);
  const totalTrades = MONTHLY.reduce((s, m) => s + m.trades, 0);
  const wins = MONTHLY.filter((m) => m.pnl > 0).length;
  const bestMonth = MONTHLY.reduce((best, m) => (m.pnl > best.pnl ? m : best));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Total P&L" value={`$${totalPnl.toLocaleString()}`} tone="success" />
        <KpiCard icon={Target} label="Win Rate" value="64.2%" tone="primary" sub="42W / 23L" />
        <KpiCard icon={Percent} label="Profit Factor" value="2.34" tone="success" />
        <KpiCard icon={Award} label="Best Month" value={bestMonth.month} tone="warning" sub={`$${bestMonth.pnl.toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly P&L chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Monthly Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-end justify-around gap-3 px-2">
              {MONTHLY.map((m) => {
                const heightPct = (Math.abs(m.pnl) / maxPnl) * 100;
                const positive = m.pnl >= 0;
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                    <span className={cn('text-xs font-bold', positive ? 'text-success' : 'text-destructive')}>
                      {positive ? '+' : ''}${(m.pnl / 1000).toFixed(1)}K
                    </span>
                    <div className="flex h-48 w-full items-end">
                      <div
                        className={cn(
                          'w-full rounded-t-md transition-all duration-700',
                          positive ? 'bg-success/70' : 'bg-destructive/70'
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{m.month}</span>
                    <span className="text-[10px] text-muted-foreground">{m.trades} trades</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Equity curve */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityCurve />
          </CardContent>
        </Card>

        {/* Stats breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatRow label="Total Trades" value={String(totalTrades)} />
            <StatRow label="Winning Months" value={`${wins}/${MONTHLY.length}`} />
            <StatRow label="Average Win" value="$2,180" />
            <StatRow label="Average Loss" value="-$1,240" />
            <StatRow label="Largest Win" value="$8,900" />
            <StatRow label="Largest Loss" value="-$1,800" />
            <StatRow label="Avg Holding Time" value="14h" />
            <StatRow label="Sharpe Ratio" value="1.82" />
            <StatRow label="Max Drawdown" value="6.4%" />
            <StatRow label="Recovery Factor" value="3.12" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: 'success' | 'primary' | 'warning';
  sub?: string;
}) {
  const colors = { success: 'text-success', primary: 'text-primary', warning: 'text-warning' };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={cn('h-4 w-4', colors[tone])} />
        </div>
        <p className={cn('mt-1 text-xl font-bold', colors[tone])}>{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-medium">{value}</span>
    </div>
  );
}

function EquityCurve() {
  const points = [200, 198, 202, 205, 203, 208, 212, 210, 216, 220, 218, 224, 230, 228, 234, 240];
  const w = 360;
  const h = 180;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${h - ((p - min) / range) * (h - 20) - 10}`)
    .join(' ');
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="overflow-visible">
      <defs>
        <linearGradient id="equity-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#equity-grad)" />
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
