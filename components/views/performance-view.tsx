'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Target, Percent, Award, Loader2, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface JournalRow {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  confidence: number | null;
  outcome: string;
  pnl: number | null;
  notes: string | null;
  opened_at: string | null;
  closed_at: string | null;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PerformanceView() {
  const [entries, setEntries] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('opened_at', { ascending: true });
      if (!cancelled) {
        if (!error && data) setEntries(data as JournalRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const closed = entries.filter((e) => e.outcome === 'win' || e.outcome === 'loss');
    const wins = closed.filter((e) => e.outcome === 'win');
    const losses = closed.filter((e) => e.outcome === 'loss');
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const totalPnl = closed.reduce((s, e) => s + (e.pnl || 0), 0);
    const grossWin = wins.reduce((s, e) => s + (e.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, e) => s + (e.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const avgWin = wins.length > 0 ? grossWin / wins.length : 0;
    const avgLoss = losses.length > 0 ? -(grossLoss / losses.length) : 0;
    const largestWin = wins.length > 0 ? Math.max(...wins.map((e) => e.pnl || 0)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map((e) => e.pnl || 0)) : 0;

    // Equity curve from closed trades (cumulative PnL)
    let running = 0;
    const equityPoints = closed.map((e) => {
      running += e.pnl || 0;
      return running;
    });

    // Max drawdown from equity curve
    let peak = -Infinity;
    let maxDd = 0;
    for (const eq of equityPoints) {
      if (eq > peak) peak = eq;
      if (peak > 0) {
        const dd = ((peak - eq) / peak) * 100;
        if (dd > maxDd) maxDd = dd;
      }
    }

    // Avg holding time
    const heldMs = closed
      .filter((e) => e.closed_at && e.opened_at)
      .map((e) => new Date(e.closed_at!).getTime() - new Date(e.opened_at!).getTime());
    const avgHolding = heldMs.length > 0
      ? heldMs.reduce((s, m) => s + m, 0) / heldMs.length
      : 0;
    const avgHoldingLabel = avgHolding <= 0
      ? '—'
      : avgHolding < 3600000
        ? `${Math.round(avgHolding / 60000)}m`
        : avgHolding < 86400000
          ? `${(avgHolding / 3600000).toFixed(1)}h`
          : `${(avgHolding / 86400000).toFixed(1)}d`;

    // Monthly aggregation
    const monthlyMap = new Map<string, { pnl: number; trades: number }>();
    for (const e of closed) {
      if (!e.closed_at) continue;
      const d = new Date(e.closed_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const cur = monthlyMap.get(key) || { pnl: 0, trades: 0 };
      cur.pnl += e.pnl || 0;
      cur.trades += 1;
      monthlyMap.set(key, cur);
    }
    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, v]) => {
        const [y, m] = key.split('-').map(Number);
        return { month: MONTH_LABELS[m], year: y, pnl: v.pnl, trades: v.trades };
      });
    const bestMonth = monthly.length > 0 ? monthly.reduce((best, m) => (m.pnl > best.pnl ? m : best)) : null;

    return {
      closedCount: closed.length,
      winCount: wins.length,
      lossCount: losses.length,
      winRate,
      totalPnl,
      profitFactor,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      equityPoints,
      maxDd,
      avgHoldingLabel,
      monthly,
      bestMonth,
    };
  }, [entries]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stats.closedCount === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground opacity-40" />
        <p className="text-sm font-semibold">No closed trades yet</p>
        <p className="text-xs text-muted-foreground">
          Log trades in the Risk &amp; Journal view — performance stats appear here automatically.
        </p>
      </div>
    );
  }

  const maxPnl = Math.max(...stats.monthly.map((m) => Math.abs(m.pnl)), 1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Total P&L" value={`$${stats.totalPnl.toLocaleString()}`} tone={stats.totalPnl >= 0 ? 'success' : 'warning'} sub={`${stats.closedCount} closed trades`} />
        <KpiCard icon={Target} label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} tone="primary" sub={`${stats.winCount}W / ${stats.lossCount}L`} />
        <KpiCard icon={Percent} label="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} tone="success" />
        <KpiCard icon={Award} label="Best Month" value={stats.bestMonth ? stats.bestMonth.month : '—'} tone="warning" sub={stats.bestMonth ? `$${stats.bestMonth.pnl.toLocaleString()} (${stats.bestMonth.year})` : 'No data'} />
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
              {stats.monthly.map((m) => {
                const heightPct = (Math.abs(m.pnl) / maxPnl) * 100;
                const positive = m.pnl >= 0;
                return (
                  <div key={`${m.year}-${m.month}`} className="flex flex-1 flex-col items-center gap-2">
                    <span className={cn('text-xs font-bold', positive ? 'text-success' : 'text-destructive')}>
                      {positive ? '+' : ''}{Math.abs(m.pnl) >= 1000 ? `$${(m.pnl / 1000).toFixed(1)}K` : `$${Math.round(m.pnl)}`}
                    </span>
                    <div className="flex h-48 w-full items-end">
                      <div
                        className={cn(
                          'w-full rounded-t-md transition-all duration-700',
                          positive ? 'bg-success/70' : 'bg-destructive/70'
                        )}
                        style={{ height: `${Math.max(heightPct, 2)}%` }}
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
            <CardTitle className="text-base">Equity Curve (realized P&L)</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityCurve points={stats.equityPoints} />
          </CardContent>
        </Card>

        {/* Stats breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatRow label="Total Trades" value={String(stats.closedCount)} />
            <StatRow label="Average Win" value={`$${Math.round(stats.avgWin).toLocaleString()}`} />
            <StatRow label="Average Loss" value={`$${Math.round(stats.avgLoss).toLocaleString()}`} />
            <StatRow label="Largest Win" value={`$${Math.round(stats.largestWin).toLocaleString()}`} />
            <StatRow label="Largest Loss" value={`$${Math.round(stats.largestLoss).toLocaleString()}`} />
            <StatRow label="Avg Holding Time" value={stats.avgHoldingLabel} />
            <StatRow label="Max Drawdown" value={`${stats.maxDd.toFixed(1)}%`} />
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

function EquityCurve({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Need at least 2 closed trades for a curve.</p>;
  }
  const w = 360;
  const h = 180;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${h - ((p - min) / range) * (h - 20) - 10}`)
    .join(' ');
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  const positive = (points[points.length - 1] ?? 0) >= 0;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="overflow-visible">
      <defs>
        <linearGradient id="equity-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#equity-grad)" />
      <path d={path} fill="none" stroke={positive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
