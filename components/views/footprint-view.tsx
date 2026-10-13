'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Grid3x3, Loader2, TrendingUp, TrendingDown, Activity,
  Flame, ChevronDown, Zap, ArrowUp, ArrowDown, BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/use-live-market';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const SYMBOLS = [
  { symbol: 'BTC/USDT', label: 'BTC' },
  { symbol: 'ETH/USDT', label: 'ETH' },
  { symbol: 'SOL/USDT', label: 'SOL' },
  { symbol: 'BNB/USDT', label: 'BNB' },
  { symbol: 'XRP/USDT', label: 'XRP' },
  { symbol: 'AVAX/USDT', label: 'AVAX' },
  { symbol: 'DOGE/USDT', label: 'DOGE' },
  { symbol: 'LINK/USDT', label: 'LINK' },
];

const TIMEFRAMES = [
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
];

interface FootprintLevel {
  price: number;
  buyVolume: number;
  sellVolume: number;
  total: number;
  delta: number;
  cumulativeDelta?: number;
}

interface FootprintCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  cumulativeDelta: number;
  pocPrice: number;
  pocVolume: number;
  levels: FootprintLevel[];
  imbalances: { price: number; direction: string }[];
  tradeCount: number;
}

function fmtVol(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(1);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function FootprintView() {
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('15');
  const [data, setData] = useState<FootprintCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const binanceSymbol = symbol.replace('/', '');
      const resp = await fetch(
        `${EDGE_FUNCTION_URL}?action=footprint&symbol=${binanceSymbol}&timeframe=${timeframe}&candles=12`,
        { headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (json.footprint && Array.isArray(json.footprint)) {
        setData(json.footprint);
        // Select the latest candle by default
        setSelectedIndex(json.footprint.length > 0 ? json.footprint.length - 1 : null);
      } else {
        throw new Error(json.error || 'No footprint data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load footprint data');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const selected = selectedIndex != null ? data[selectedIndex] : null;

  // Aggregate stats across all candles
  const totalBuy = data.reduce((s, c) => s + c.buyVolume, 0);
  const totalSell = data.reduce((s, c) => s + c.sellVolume, 0);
  const totalDelta = totalBuy - totalSell;
  const avgTradeCount = data.length > 0 ? Math.round(data.reduce((s, c) => s + c.tradeCount, 0) / data.length) : 0;

  // Cumulative delta trend
  const deltaTrend = data.slice(-3).every((c) => c.delta > 0) ? 'bullish'
    : data.slice(-3).every((c) => c.delta < 0) ? 'bearish' : 'mixed';

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {SYMBOLS.map((s) => (
            <button
              key={s.symbol}
              onClick={() => setSymbol(s.symbol)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                symbol === s.symbol
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                timeframe === tf.value
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Buy Volume"
          value={fmtVol(totalBuy)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Total Sell Volume"
          value={fmtVol(totalSell)}
          icon={TrendingDown}
          tone="destructive"
        />
        <StatCard
          label="Cumulative Delta"
          value={`${totalDelta >= 0 ? '+' : ''}${fmtVol(totalDelta)}`}
          icon={Activity}
          tone={totalDelta >= 0 ? 'success' : 'destructive'}
        />
        <StatCard
          label="Delta Trend"
          value={deltaTrend === 'bullish' ? 'Bullish' : deltaTrend === 'bearish' ? 'Bearish' : 'Mixed'}
          icon={Zap}
          tone={deltaTrend === 'bullish' ? 'success' : deltaTrend === 'bearish' ? 'destructive' : 'warning'}
        />
      </div>

      {/* Main footprint display */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Candle strip */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Grid3x3 className="h-4 w-4 text-primary" />
              {symbol} Footprint · {TIMEFRAMES.find((t) => t.value === timeframe)?.label}
            </CardTitle>
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Badge variant="outline" className="text-[10px] border-success/40 text-success">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex h-64 items-center justify-center text-sm text-destructive">
                {error}
              </div>
            ) : data.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex gap-1 overflow-x-auto pb-2">
                {data.map((c, i) => {
                  const isBull = c.close >= c.open;
                  const isSelected = selectedIndex === i;
                  const maxVol = Math.max(...(c.levels?.map((l) => l.total) || []), 1);
                  const maxBarH = 120;
                  const isUp = c.delta >= 0;

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedIndex(i)}
                      className={cn(
                        'group flex min-w-[72px] flex-col items-center rounded-lg border p-2 transition-all',
                        isSelected
                          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-secondary/20 hover:bg-secondary/40'
                      )}
                    >
                      {/* Delta bar */}
                      <div className="flex h-4 items-center justify-center text-[10px] font-bold">
                        <span className={isUp ? 'text-success' : 'text-destructive'}>
                          {isUp ? '+' : ''}{fmtVol(c.delta)}
                        </span>
                      </div>

                      {/* Mini footprint bars (volume profile) */}
                      <div className="my-1 flex h-[100px] flex-col-reverse justify-center gap-[1px]">
                        {(c.levels || []).slice(0, 18).map((lvl, li) => {
                          const barH = Math.max(2, (lvl.total / maxVol) * maxBarH);
                          const buyRatio = lvl.total > 0 ? lvl.buyVolume / lvl.total : 0;
                          const isPOC = Math.abs(lvl.price - c.pocPrice) < (c.high - c.low) / 40;
                          const imbs = c.imbalances || [];
                          const hasImbalance = imbs.some((imb) => Math.abs(imb.price - lvl.price) < (c.high - c.low) / 40);
                          const imbDir = imbs.find((imb) => Math.abs(imb.price - lvl.price) < (c.high - c.low) / 40)?.direction;

                          return (
                            <div
                              key={li}
                              className="relative flex h-[5px] items-center overflow-hidden rounded-[1px]"
                              title={`$${formatPrice(lvl.price)} | Buy: ${fmtVol(lvl.buyVolume)} Sell: ${fmtVol(lvl.sellVolume)}`}
                            >
                              {/* Buy side (left, green) */}
                              <div
                                className="h-full bg-success/70 transition-all"
                                style={{ width: `${buyRatio * 100}%` }}
                              />
                              {/* Sell side (right, red) */}
                              <div
                                className="ml-auto h-full bg-destructive/70 transition-all"
                                style={{ width: `${(1 - buyRatio) * 100}%` }}
                              />
                              {/* POC highlight */}
                              {isPOC && (
                                <div className="absolute inset-0 ring-1 ring-inset ring-yellow-400/60" />
                              )}
                              {/* Imbalance marker */}
                              {hasImbalance && (
                                <div className={cn(
                                  'absolute -right-0.5 top-0 h-full w-1',
                                  imbDir === 'buy' ? 'bg-success' : 'bg-destructive'
                                )} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Candle info */}
                      <div className={cn('text-[10px] font-mono font-bold', isBull ? 'text-success' : 'text-destructive')}>
                        {formatPrice(c.close)}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{fmtTime(c.time)}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                        <BarChart3 className="h-2.5 w-2.5" />
                        {c.tradeCount}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected candle detail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-accent" />
              {selected ? `Candle Detail · ${fmtTime(selected.time)}` : 'Candle Detail'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selected ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Select a candle to view details
              </div>
            ) : (
              <>
                {/* OHLC + Delta summary */}
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open</span>
                    <span className="font-mono">{formatPrice(selected.open)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Close</span>
                    <span className={cn('font-mono font-bold', selected.close >= selected.open ? 'text-success' : 'text-destructive')}>
                      {formatPrice(selected.close)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">High</span>
                    <span className="font-mono">{formatPrice(selected.high)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Low</span>
                    <span className="font-mono">{formatPrice(selected.low)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trades</span>
                    <span className="font-mono">{selected.tradeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">POC</span>
                    <span className="font-mono font-bold text-yellow-500">{formatPrice(selected.pocPrice)}</span>
                  </div>
                </div>

                {/* Buy/Sell volume bars */}
                <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-success">
                        <ArrowUp className="h-3 w-3" /> Buy Volume
                      </span>
                      <span className="font-mono">{fmtVol(selected.buyVolume)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-success/70 transition-all"
                        style={{ width: `${selected.totalVolume > 0 ? (selected.buyVolume / selected.totalVolume) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-destructive">
                        <ArrowDown className="h-3 w-3" /> Sell Volume
                      </span>
                      <span className="font-mono">{fmtVol(selected.sellVolume)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-destructive/70 transition-all"
                        style={{ width: `${selected.totalVolume > 0 ? (selected.sellVolume / selected.totalVolume) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                    <span className="font-medium">Delta</span>
                    <span className={cn('font-mono font-bold', selected.delta >= 0 ? 'text-success' : 'text-destructive')}>
                      {selected.delta >= 0 ? '+' : ''}{fmtVol(selected.delta)}
                    </span>
                  </div>
                </div>

                {/* Price levels table */}
                <div className="rounded-lg border border-border">
                  <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Price Levels</span>
                    <span className="text-[10px] text-muted-foreground">Buy | Sell | Delta</span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {(selected.levels || []).slice(0, 24).map((lvl, i) => {
                      const isPOC = Math.abs(lvl.price - selected.pocPrice) < (selected.high - selected.low) / 40;
                      const selImbs = selected.imbalances || [];
                      const hasImb = selImbs.some((imb) => Math.abs(imb.price - lvl.price) < (selected.high - selected.low) / 40);
                      const imbDir = selImbs.find((imb) => Math.abs(imb.price - lvl.price) < (selected.high - selected.low) / 40)?.direction;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center justify-between px-3 py-1 text-[11px] font-mono border-b border-border/30',
                            isPOC && 'bg-yellow-500/10'
                          )}
                        >
                          <span className={cn('font-semibold', isPOC && 'text-yellow-500')}>
                            {formatPrice(lvl.price)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-success">{fmtVol(lvl.buyVolume)}</span>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-destructive">{fmtVol(lvl.sellVolume)}</span>
                            <span className={cn(
                              'ml-1 w-12 text-right font-bold',
                              lvl.delta >= 0 ? 'text-success' : 'text-destructive'
                            )}>
                              {lvl.delta >= 0 ? '+' : ''}{fmtVol(lvl.delta)}
                            </span>
                            {hasImb && (
                              <span className={cn(
                                'ml-1 flex h-3.5 w-3.5 items-center justify-center rounded text-[8px] font-bold text-white',
                                imbDir === 'buy' ? 'bg-success' : 'bg-destructive'
                              )}>
                                I
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Imbalances */}
                {selected.imbalances && selected.imbalances.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                      <Zap className="h-3 w-3" /> Stacked Imbalances ({selected.imbalances.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.imbalances.map((imb, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={cn(
                            'text-[10px] font-mono',
                            imb.direction === 'buy'
                              ? 'border-success/40 text-success'
                              : 'border-destructive/40 text-destructive'
                          )}
                        >
                          {imb.direction === 'buy' ? 'Buy' : 'Sell'} @ {formatPrice(imb.price)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-secondary/20 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-success/70" /> Buy Volume (aggressive buyers)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-destructive/70" /> Sell Volume (aggressive sellers)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm ring-1 ring-inset ring-yellow-400/60" /> POC (Point of Control)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-3 w-3 items-center justify-center rounded bg-warning text-[7px] font-bold text-white">I</span>
          Imbalance (3:1 ratio)
        </span>
        <span className="ml-auto text-[10px]">
          Data from Binance Aggregated Trades · Updates every 15s
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'success' | 'destructive' | 'warning' | 'primary';
}) {
  const colors = {
    success: 'text-success',
    destructive: 'text-destructive',
    warning: 'text-warning',
    primary: 'text-primary',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={cn('h-3.5 w-3.5', colors[tone])} />
        </div>
        <p className={cn('mt-1.5 text-lg font-bold', colors[tone])}>{value}</p>
      </CardContent>
    </Card>
  );
}
