'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Activity,
  Zap,
  Trophy,
  Gauge,
  Radio,
  RefreshCw,
  Loader2,
  ChevronRight,
  BarChart3,
  Layers,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfidenceRing } from '@/components/confidence-ring';
import { useLiveMarket, formatPrice, formatPct } from '@/lib/use-live-market';
import { useLiveGlobal } from '@/lib/use-live-global';
import { Sparkline } from '@/components/sparkline';
import { runScanner } from '@/lib/scanner-engine';
import type { ScannerResult, StrategyType, SignalDirection } from '@/lib/types';
import { cn } from '@/lib/utils';

const STRATEGY_META: Record<StrategyType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  scalping: { label: 'Scalping', icon: Crosshair, color: 'text-accent', bg: 'bg-accent/15' },
  day: { label: 'Day Trading', icon: Clock, color: 'text-primary', bg: 'bg-primary/15' },
  swing: { label: 'Swing Trading', icon: Calendar, color: 'text-warning', bg: 'bg-warning/15' },
};

export function ScannerView() {
  const coins = useLiveMarket(30000);
  const { data: global } = useLiveGlobal();
  const [results, setResults] = useState<ScannerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [selected, setSelected] = useState<ScannerResult | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Always read the freshest coins inside the interval without re-registering it
  const coinsRef = useRef(coins);
  useEffect(() => { coinsRef.current = coins; }, [coins]);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const live = await runScanner(coinsRef.current);
      setResults(live);
      setLastScan(new Date());
      if (live.length > 0) {
        setSelected((prev) => live.find((r) => r.symbol === prev?.symbol) ?? live[0]);
      } else {
        setSelected(null);
      }
    } catch {
      // keep existing results
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scan();
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(scan, 3_600_000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [scan, autoRefresh]);

  const scalpingResults = results.filter((r) => r.bestStrategy === 'scalping');
  const dayResults = results.filter((r) => r.bestStrategy === 'day');
  const swingResults = results.filter((r) => r.bestStrategy === 'swing');
  const highestConfidence = [...results].sort((a, b) => b.confidence - a.confidence);
  const highestRR = [...results].sort((a, b) => {
    const rrA = parseFloat(a.riskReward.split(':')[1]);
    const rrB = parseFloat(b.riskReward.split(':')[1]);
    return rrB - rrA;
  });

  // Market trend overview
  const bullCount = results.filter((r) => r.direction === 'LONG').length;
  const bearCount = results.filter((r) => r.direction === 'SHORT').length;
  const avgConfidence = results.length > 0 ? results.reduce((s, r) => s + r.confidence, 0) / results.length : 0;
  const marketTrend = bullCount > bearCount ? 'Bullish' : bearCount > bullCount ? 'Bearish' : 'Neutral';

  // Real 7-day performance from CoinGecko sparkline data (live)
  const sevenDay = coins
    .map((c) => {
      const s = c.sparkline ?? [];
      const first = s[0];
      const last = s[s.length - 1];
      const ch7d = first && last ? ((last - first) / first) * 100 : null;
      return { ...c, ch7d };
    })
    .filter((c) => c.ch7d !== null)
    .sort((a, b) => (b.ch7d ?? 0) - (a.ch7d ?? 0));

  return (
    <div className="space-y-6">
      {/* Scanner header / controls */}
      <Card className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
        <CardContent className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
              <Crosshair className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Smart Trading Coin Scanner</h2>
              <p className="text-xs text-muted-foreground">
                24/7 multi-timeframe AI analysis · Auto-refresh every hour
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="flex items-center gap-2 text-xs text-primary">
                <Radio className="h-3.5 w-3.5 animate-pulse" /> Scanning 15 major coins…
              </span>
            ) : lastScan ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success" /> Last scan {timeAgo(lastScan.toISOString())}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={scan}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              {loading ? 'Scanning…' : 'Scan Now'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Market Trend Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TrendCard
          label="Market Trend"
          value={marketTrend}
          icon={marketTrend === 'Bullish' ? TrendingUp : marketTrend === 'Bearish' ? TrendingDown : Activity}
          tone={marketTrend === 'Bullish' ? 'success' : marketTrend === 'Bearish' ? 'destructive' : 'neutral'}
          sub={`${bullCount} bullish / ${bearCount} bearish`}
        />
        <TrendCard
          label="Coins Found"
          value={String(results.length)}
          icon={Trophy}
          tone="primary"
          sub="Max 10 per scan"
        />
        <TrendCard
          label="Avg Confidence"
          value={`${avgConfidence.toFixed(0)}%`}
          icon={Gauge}
          tone="accent"
          sub="Min 65% threshold"
        />
        <TrendCard
          label="BTC Dominance"
          value={global?.btcDominance != null ? `${global.btcDominance.toFixed(1)}%` : '—'}
          icon={BarChart3}
          tone="warning"
          sub="Live · CoinGecko"
        />
      </div>

      {/* Loading state */}
      {loading && results.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-4">
              <div className="h-16 w-16 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <Crosshair className="absolute inset-0 m-auto h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Scanning entire crypto market…</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fetching live data across 5 timeframes (15M, 1H, 4H, 1D, 1W) for 15 major coins
            </p>
          </CardContent>
        </Card>
      )}

      {/* No signals */}
      {!loading && results.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-warning opacity-50" />
            <p className="text-base font-semibold">No High Probability Trade Available</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              The scanner found no setups meeting the minimum 80% confidence and 1:2 risk/reward
              criteria. The module will automatically re-scan every hour.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={scan}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Scan Now
            </Button>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <>
          {/* Top 10 Coin Hunt + Detail */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Top 10 Coin Hunt
                </h3>
              </div>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <button
                    key={r.symbol}
                    onClick={() => setSelected(r)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all',
                      selected?.symbol === r.symbol
                        ? 'border-primary/50 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/30'
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{r.symbol.split('/')[0]}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-1.5 py-0 text-[10px] font-bold',
                            r.direction === 'LONG' ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'
                          )}
                        >
                          {r.direction}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={cn('text-[10px] font-medium', STRATEGY_META[r.bestStrategy].color)}>
                          {STRATEGY_META[r.bestStrategy].label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">RR {r.riskReward}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-semibold">${formatPrice(r.price)}</p>
                      <p className="text-[10px] text-primary">{r.confidence}%</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-3">
              {selected && <CoinDetail result={selected} />}
            </div>
          </div>

          {/* Strategy sections */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <StrategySection
              title="Scalping Opportunities"
              strategy="scalping"
              results={scalpingResults}
            />
            <StrategySection
              title="Day Trading Opportunities"
              strategy="day"
              results={dayResults}
            />
            <StrategySection
              title="Swing Trading Opportunities"
              strategy="swing"
              results={swingResults}
            />
          </div>

          {/* Highest Confidence + Highest RR */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-4 w-4 text-primary" />
                  Highest Confidence Trades
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {highestConfidence.slice(0, 5).map((r) => (
                  <MiniResultRow key={r.symbol} result={r} onClick={() => setSelected(r)} />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-accent" />
                  Highest Risk/Reward Trades
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {highestRR.slice(0, 5).map((r) => (
                  <MiniResultRow key={r.symbol} result={r} onClick={() => setSelected(r)} highlightRR />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Real 7-day market performance (from live sparkline data) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                7-Day Market Performance
                <Badge variant="outline" className="border-success/40 text-[10px] font-normal text-success">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {sevenDay.slice(0, 10).map((c) => {
                  const up = (c.ch7d ?? 0) >= 0;
                  return (
                    <div key={c.symbol} className="rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">{c.symbol.split('/')[0]}</p>
                        <Sparkline data={c.sparkline} positive={up} width={64} height={22} />
                      </div>
                      <p className={cn('mt-1.5 text-lg font-bold', up ? 'text-success' : 'text-destructive')}>
                        {formatPct(c.ch7d ?? 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">7d · ${formatPrice(c.price)}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-warning">Disclaimer:</span> AI-generated signals are for
              educational and informational purposes only. Not financial advice. The scanner prioritizes
              capital protection — no trade is forced when confirmations are insufficient.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function CoinDetail({ result }: { result: ScannerResult }) {
  const isLong = result.direction === 'LONG';
  const meta = STRATEGY_META[result.bestStrategy];
  return (
    <Card className="animate-fade-in">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl',
                isLong ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
              )}
            >
              {isLong ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {result.symbol}
                <Badge
                  variant="outline"
                  className={cn(
                    'px-2 py-0.5 text-xs font-bold',
                    isLong ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'
                  )}
                >
                  {result.direction}
                </Badge>
                <Badge variant="outline" className="border-success/40 text-[10px] text-success">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
                </Badge>
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {result.name} · Scanned {timeAgo(result.scannedAt)}
              </p>
            </div>
          </div>
          <ConfidenceRing value={result.confidence} size={64} stroke={5} label="conf" />
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {/* Best strategy banner */}
        <div className={cn('flex items-center justify-between rounded-lg border p-3', meta.bg, `border-${meta.color.split('-')[1]}/30`)}>
          <div className="flex items-center gap-2">
            <meta.icon className={cn('h-5 w-5', meta.color)} />
            <div>
              <p className="text-sm font-bold">Best Strategy: {meta.label}</p>
              <p className="text-[11px] text-muted-foreground">Holding time: {result.holdingTime}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold" style={{ color: meta.color.includes('accent') ? 'hsl(var(--accent))' : meta.color.includes('primary') ? 'hsl(var(--primary))' : 'hsl(var(--warning))' }}>
              {result.bestStrategy === 'scalping' ? result.scalpingScore : result.bestStrategy === 'day' ? result.dayScore : result.swingScore}/100
            </p>
            <p className="text-[10px] text-muted-foreground">{meta.label.split(' ')[0]} score</p>
          </div>
        </div>

        {/* Suitability scores */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Trade Suitability Scores
          </p>
          <div className="grid grid-cols-3 gap-3">
            <ScoreBar label="Scalping" value={result.scalpingScore} color="hsl(var(--accent))" />
            <ScoreBar label="Day" value={result.dayScore} color="hsl(var(--primary))" />
            <ScoreBar label="Swing" value={result.swingScore} color="hsl(var(--warning))" />
          </div>
        </div>

        {/* Price levels */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <PriceLevel label="Entry" value={result.entry} icon={Activity} tone="primary" />
          <PriceLevel label="Stop Loss" value={result.stopLoss} icon={ShieldAlert} tone="destructive" />
          <PriceLevel label="Exit" value={result.exit} icon={Target} tone="success" />
        </div>

        {/* TP levels */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Take Profit Levels
          </p>
          <div className="grid grid-cols-3 gap-3">
            <TpLevel level="TP1" value={result.tp1} pct={pctFromEntry(result.entry, result.tp1, isLong)} />
            <TpLevel level="TP2" value={result.tp2} pct={pctFromEntry(result.entry, result.tp2, isLong)} />
            <TpLevel level="TP3" value={result.tp3} pct={pctFromEntry(result.entry, result.tp3, isLong)} />
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Risk/Reward" value={result.riskReward} icon={Target} />
          <Metric label="Holding Time" value={result.holdingTime} icon={Clock} small />
          <Metric label="Leverage" value={result.leverage} icon={Zap} small />
          <Metric label="Trailing Stop" value={result.trailingStop} icon={ShieldAlert} small />
        </div>

        {/* Multi-timeframe */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Multi-Timeframe Analysis
          </p>
          <div className="grid grid-cols-5 gap-2">
            {result.multiTimeframe.map((tf) => (
              <div key={tf.timeframe} className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">{tf.timeframe}</p>
                <div className="mt-1 flex justify-center">
                  <SignalDot signal={tf.bias} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">RSI {tf.rsi.toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Layers className="h-3.5 w-3.5" /> AI Analysis
          </p>
          <ul className="space-y-2">
            {result.analysis.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function StrategySection({
  title,
  strategy,
  results,
}: {
  title: string;
  strategy: StrategyType;
  results: ScannerResult[];
}) {
  const meta = STRATEGY_META[strategy];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <meta.icon className={cn('h-4 w-4', meta.color)} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {results.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No {meta.label.toLowerCase()} setups found in this scan
          </p>
        ) : (
          results.map((r) => (
            <div
              key={r.symbol}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 transition-colors hover:border-primary/30"
            >
              <div className="flex items-center gap-2">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', meta.bg)}>
                  <meta.icon className={cn('h-4 w-4', meta.color)} />
                </div>
                <div>
                  <p className="text-sm font-bold">{r.symbol.split('/')[0]}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.direction} · RR {r.riskReward}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs font-semibold">${formatPrice(r.price)}</p>
                <p className="text-[10px] text-primary">{r.confidence}%</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MiniResultRow({
  result,
  onClick,
  highlightRR,
}: {
  result: ScannerResult;
  onClick: () => void;
  highlightRR?: boolean;
}) {
  const isLong = result.direction === 'LONG';
  const meta = STRATEGY_META[result.bestStrategy];
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 text-left transition-colors hover:border-primary/30"
    >
      <div className="flex items-center gap-2">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', meta.bg)}>
          <meta.icon className={cn('h-3.5 w-3.5', meta.color)} />
        </div>
        <div>
          <p className="text-xs font-bold">{result.symbol.split('/')[0]}</p>
          <p className="text-[10px] text-muted-foreground">
            {result.direction} · {meta.label.split(' ')[0]}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {highlightRR ? (
          <span className="font-mono text-xs font-bold text-accent">{result.riskReward}</span>
        ) : (
          <span className="font-mono text-xs font-bold text-primary">{result.confidence}%</span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground">${formatPrice(result.price)}</span>
      </div>
    </button>
  );
}

function TrendCard({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'success' | 'destructive' | 'neutral' | 'primary' | 'accent' | 'warning';
  sub: string;
}) {
  const colors = {
    success: 'text-success',
    destructive: 'text-destructive',
    neutral: 'text-muted-foreground',
    primary: 'text-primary',
    accent: 'text-accent',
    warning: 'text-warning',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={cn('h-4 w-4', colors[tone])} />
        </div>
        <p className={cn('mt-1 text-xl font-bold', colors[tone])}>{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold" style={{ color }}>{value}</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function PriceLevel({
  label, value, icon: Icon, tone,
}: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'primary' | 'destructive' | 'success';
}) {
  const colors = {
    primary: 'border-primary/30 bg-primary/5 text-primary',
    destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
    success: 'border-success/30 bg-success/5 text-success',
  };
  return (
    <div className={cn('rounded-lg border p-3', colors[tone])}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        <Icon className="h-3 w-3" />{label}
      </div>
      <p className="font-mono text-lg font-bold">${formatPrice(value)}</p>
    </div>
  );
}

function TpLevel({ level, value, pct }: { level: string; value: number; pct: string }) {
  return (
    <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-success">{level}</p>
      <p className="mt-1 font-mono text-sm font-bold">${formatPrice(value)}</p>
      <p className="text-[10px] text-muted-foreground">{pct}</p>
    </div>
  );
}

function Metric({
  label, value, icon: Icon, small,
}: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />{label}
      </div>
      <p className={cn('font-medium', small ? 'text-xs' : 'text-sm')}>{value}</p>
    </div>
  );
}

function SignalDot({ signal }: { signal: 'bullish' | 'bearish' | 'neutral' }) {
  const Icon = signal === 'bullish' ? CheckCircle2 : signal === 'bearish' ? XCircle : MinusCircle;
  const color = signal === 'bullish' ? 'text-success' : signal === 'bearish' ? 'text-destructive' : 'text-muted-foreground';
  return <Icon className={cn('h-4 w-4', color)} />;
}

function pctFromEntry(entry: number, target: number, isLong: boolean): string {
  const pct = ((target - entry) / entry) * 100 * (isLong ? 1 : -1);
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}
