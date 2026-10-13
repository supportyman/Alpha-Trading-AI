'use client';

import { useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Radar,
  Gauge,
  Newspaper,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Star,
  Activity,
  Zap,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkline } from '@/components/sparkline';
import { ConfidenceRing } from '@/components/confidence-ring';
import { useLiveMarket, formatPrice, formatPct, formatCompact } from '@/lib/use-live-market';
import { useLiveNews } from '@/lib/use-live-news';
import { useLiveGlobal } from '@/lib/use-live-global';
import { useLiveSentiment } from '@/lib/use-live-sentiment';
import { generateSignals } from '@/lib/signal-engine';
import type { TradeSignal, ViewKey } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DashboardViewProps {
  onNavigate: (v: ViewKey) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const coins = useLiveMarket(5000);
  const { sentiment } = useLiveSentiment();
  const { data: global } = useLiveGlobal();
  const { news, usingLive: newsLive } = useLiveNews();
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  // Keep a ref to the latest coins so the interval always reads fresh prices
  const coinsRef = useRef(coins);
  useEffect(() => { coinsRef.current = coins; }, [coins]);

  useEffect(() => {
    let cancelled = false;
    const fetchSignals = async () => {
      setSignalsLoading(true);
      try {
        const liveSignals = await generateSignals(coinsRef.current, 65);
        if (!cancelled && liveSignals.length > 0) {
          setSignals(liveSignals);
        }
      } catch {
        // keep fallback signals
      } finally {
        if (!cancelled) setSignalsLoading(false);
      }
    };
    fetchSignals();
    const t = setInterval(fetchSignals, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const topGainers = [...coins].sort((a, b) => b.change24h - a.change24h).slice(0, 4);
  const topLosers = [...coins].sort((a, b) => a.change24h - b.change24h).slice(0, 4);
  const watchlistSymbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT', 'LINK/USDT'];
  const watchlist = coins.filter((c) => watchlistSymbols.includes(c.symbol));

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Global Market Cap"
          value={global?.marketCap != null ? formatCompact(global.marketCap) : '—'}
          change={global?.marketCapChange24h != null ? `24h ${formatPct(global.marketCapChange24h)}` : 'CoinGecko global'}
          positive={(global?.marketCapChange24h ?? 1) >= 0}
          icon={Activity}
        />
        <StatCard
          label="BTC Dominance"
          value={global?.btcDominance != null ? `${global.btcDominance.toFixed(1)}%` : '—'}
          change={global?.ethDominance != null ? `ETH ${global.ethDominance.toFixed(1)}%` : 'Live from CoinGecko'}
          neutral
          icon={TrendingUp}
        />
        <StatCard
          label="Fear & Greed"
          value={
            sentiment.fng
              ? `${sentiment.fng.value} · ${sentiment.fng.label}`
              : `${sentiment.score} · ${sentiment.mood}`
          }
          change={sentiment.fng ? 'alternative.me index' : 'Derived from price action'}
          positive={(sentiment.fng ? sentiment.fng.value : sentiment.score) >= 50}
          icon={Gauge}
        />
        <StatCard
          label="Active Signals"
          value={signalsLoading ? '…' : String(signals.length)}
          change={signalsLoading ? 'Scanning…' : 'Live'}
          positive
          icon={Radar}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Market overview */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Market Overview</CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] font-normal border-success/40 text-success">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
              </Badge>
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                CoinGecko
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-success">
                  Top Gainers
                </p>
                <div className="space-y-1">
                  {topGainers.map((c) => (
                    <CoinRow key={c.symbol} coin={c} compact />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-destructive">
                  Top Losers
                </p>
                <div className="space-y-1">
                  {topLosers.map((c) => (
                    <CoinRow key={c.symbol} coin={c} compact />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sentiment gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Market Sentiment</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <SentimentGauge
              score={sentiment.fng ? sentiment.fng.value : sentiment.score}
              label={sentiment.fng ? sentiment.fng.label : sentiment.mood}
            />
            <div className="mt-3 grid w-full grid-cols-2 gap-2 text-center">
              <MiniStat label="Momentum" value={sentiment.twitter} />
              <MiniStat label="Breadth" value={sentiment.reddit} />
              <MiniStat label="Flow" value={sentiment.telegram} />
              <MiniStat label="Headlines" value={sentiment.news} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-xs text-primary"
              onClick={() => onNavigate('sentiment')}
            >
              View full dashboard
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Watchlist + Signals */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-warning" />
              Live Watchlist
            </CardTitle>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add pair
            </Button>
          </CardHeader>
          <CardContent className="px-2">
            <div className="grid grid-cols-12 gap-2 border-b border-border px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="col-span-3">Pair</span>
              <span className="col-span-3 text-right">Price</span>
              <span className="col-span-2 text-right">24h</span>
              <span className="col-span-2 text-right hidden sm:block">Volume</span>
              <span className="col-span-2 text-right">Chart</span>
            </div>
            {watchlist.map((c) => (
              <CoinRow key={c.symbol} coin={c} full />
            ))}
          </CardContent>
        </Card>

        {/* AI Signals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              AI Trade Signals
              <Badge variant="outline" className="border-success/40 text-[10px] text-success">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
              </Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-primary"
              onClick={() => onNavigate('signals')}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {signalsLoading && signals.length === 0 && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg border border-border bg-secondary/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 w-20 rounded bg-secondary" />
                        <div className="h-4 w-12 rounded bg-secondary" />
                      </div>
                      <div className="h-10 w-10 rounded-full bg-secondary" />
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 w-24 rounded bg-secondary" />
                      <div className="h-3 w-16 rounded bg-secondary" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!signalsLoading && signals.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No signals above 65% confidence right now.
                <br />Scanning live markets every 60s.
              </div>
            )}
            {signals.slice(0, 3).map((s) => (
              <button
                key={s.id}
                onClick={() => onNavigate('signals')}
                className="w-full rounded-lg border border-border bg-secondary/40 p-3 text-left transition-all hover:border-primary/40 hover:bg-secondary/70"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{s.symbol}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'px-1.5 py-0 text-[10px] font-bold',
                        s.direction === 'LONG'
                          ? 'border-success/40 text-success'
                          : 'border-destructive/40 text-destructive'
                      )}
                    >
                      {s.direction}
                    </Badge>
                  </div>
                  <ConfidenceRing value={s.confidence} size={40} stroke={3} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Entry ${formatPrice(s.entry)}</span>
                  <span>RR {s.riskReward}</span>
                  <span className="text-[10px]">{s.timeframe}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* News feed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-accent" />
              Fundamental News Feed
              {newsLive && (
                <Badge variant="outline" className="border-success/40 text-[10px] font-normal text-success">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={() => onNavigate('fundamental')}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {news.slice(0, 6).map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'px-1.5 py-0 text-[10px] capitalize',
                    n.sentiment === 'bullish' && 'border-success/40 text-success',
                    n.sentiment === 'bearish' && 'border-destructive/40 text-destructive',
                    n.sentiment === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {n.sentiment}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{n.time}</span>
              </div>
              <p className="mb-1 line-clamp-2 text-xs font-medium leading-snug">{n.title}</p>
              <p className="text-[11px] text-muted-foreground">{n.source} · {n.category}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <DisclaimerBanner />
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  positive,
  neutral,
  icon: Icon,
}: {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  neutral?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 opacity-5">
        <Icon className="h-full w-full" />
      </div>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
        <p
          className={cn(
            'mt-0.5 flex items-center gap-1 text-xs',
            neutral ? 'text-muted-foreground' : positive ? 'text-success' : 'text-destructive'
          )}
        >
          {!neutral && (positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
          {change}
        </p>
      </CardContent>
    </Card>
  );
}

function CoinRow({
  coin,
  compact,
  full,
}: {
  coin: { symbol: string; name: string; price: number; change24h: number; volume24h: number; sparkline: number[] };
  compact?: boolean;
  full?: boolean;
}) {
  const positive = coin.change24h >= 0;
  if (full) {
    return (
      <div className="grid grid-cols-12 items-center gap-2 border-b border-border/50 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40">
        <div className="col-span-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
            {coin.symbol.split('/')[0].slice(0, 3)}
          </div>
          <div>
            <p className="text-xs font-semibold">{coin.symbol.split('/')[0]}</p>
            <p className="text-[10px] text-muted-foreground">{coin.name}</p>
          </div>
        </div>
        <span className="col-span-3 text-right font-mono text-xs font-medium">
          ${formatPrice(coin.price)}
        </span>
        <span className={cn('col-span-2 text-right font-mono text-xs', positive ? 'text-success' : 'text-destructive')}>
          {formatPct(coin.change24h)}
        </span>
        <span className="col-span-2 hidden text-right font-mono text-xs text-muted-foreground sm:block">
          {formatCompact(coin.volume24h)}
        </span>
        <div className="col-span-2 flex justify-end">
          <Sparkline data={coin.sparkline} positive={positive} width={80} height={28} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/40">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[9px] font-bold">
          {coin.symbol.split('/')[0].slice(0, 3)}
        </div>
        <span className="text-xs font-medium">{coin.symbol}</span>
      </div>
      <div className="flex items-center gap-3">
        <Sparkline data={coin.sparkline} positive={positive} width={60} height={22} />
        <div className="text-right">
          <p className="font-mono text-xs font-medium">${formatPrice(coin.price)}</p>
          <p className={cn('font-mono text-[10px]', positive ? 'text-success' : 'text-destructive')}>
            {formatPct(coin.change24h)}
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-secondary/50 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function SentimentGauge({ score, label }: { score: number; label: string }) {
  const angle = (score / 100) * 180 - 90;
  const color =
    score >= 75 ? 'hsl(var(--success))' : score >= 55 ? 'hsl(var(--primary))' : score >= 35 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
  return (
    <div className="relative h-28 w-44">
      <svg viewBox="0 0 180 100" className="h-full w-full">
        <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 10 90 A 80 80 0 0 1 170 90"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="251"
          strokeDashoffset={251 - (score / 100) * 251}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <g transform={`rotate(${angle} 90 90)`}>
          <line x1="90" y1="90" x2="90" y2="22" stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round" />
          <circle cx="90" cy="90" r="5" fill="hsl(var(--foreground))" />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-2xl font-bold" style={{ color }}>
          {score}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function DisclaimerBanner() {
  return (
    <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-warning">Disclaimer:</span> AI-generated signals are for
        educational and informational purposes only. Not financial advice. Never invest more than you
        can afford to lose.
      </p>
    </div>
  );
}
