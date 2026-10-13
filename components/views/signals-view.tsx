'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Clock,
  Activity,
  ChevronRight,
  Sliders,
  Loader2,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ConfidenceRing } from '@/components/confidence-ring';
import { useLiveMarket, formatPrice } from '@/lib/use-live-market';
import { generateSignals } from '@/lib/signal-engine';
import type { TradeSignal } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DisclaimerBanner } from './dashboard-view';
import { toast } from '@/hooks/use-toast';

const HIGH_CONFIDENCE = 75;

export function SignalsView({ selectedSignal }: { selectedSignal?: TradeSignal | null }) {
  const [threshold, setThreshold]   = useState(65);
  const [signals, setSignals]       = useState<TradeSignal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastScan, setLastScan]     = useState<Date | null>(null);
  const [selected, setSelected]     = useState<TradeSignal | null>(null);
  const coins = useLiveMarket(30000);

  // When a signal is passed from outside (e.g. the top alert banner), select it
  useEffect(() => {
    if (selectedSignal) setSelected(selectedSignal);
  }, [selectedSignal]);

  // Keep a ref to the latest coins so the interval always reads fresh prices
  const coinsRef = useRef(coins);
  useEffect(() => { coinsRef.current = coins; }, [coins]);

  // Track which signal symbols we've already notified about so we only fire
  // a toast for genuinely NEW high-confidence opportunities.
  const notifiedRef = useRef<Set<string>>(new Set());
  // Keep latest signals accessible from toast action callbacks
  const signalsRef = useRef<TradeSignal[]>([]);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const live = await generateSignals(coinsRef.current, threshold);
      setSignals(live);
      signalsRef.current = live;
      setLastScan(new Date());
      if (live.length > 0) setSelected((prev) => live.find((s) => s.symbol === prev?.symbol) ?? live[0]);

      // Fire toast notifications for new high-confidence signals
      const newOpportunities = live.filter(
        (s) => s.confidence >= HIGH_CONFIDENCE && !notifiedRef.current.has(s.id),
      );
      for (const sig of newOpportunities) {
        notifiedRef.current.add(sig.id);
        toast({
          title: `${sig.symbol} ${sig.direction} signal — ${sig.confidence}% confidence`,
          description: `Entry ${formatPrice(sig.entry)} · TP1 ${formatPrice(sig.tp1)} · SL ${formatPrice(sig.stopLoss)} · RR ${sig.riskReward}`,
          action: (
            <button
              onClick={() => {
                setSelected(sig);
                document.getElementById('signals-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Zap className="h-3.5 w-3.5" /> View Trade Setup
            </button>
          ),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  // Re-scan whenever threshold changes and on a 60s interval
  useEffect(() => {
    scan();
    const t = setInterval(scan, 60_000);
    return () => clearInterval(t);
  }, [scan]);

  const filtered = signals.filter((s) => s.confidence >= threshold);

  return (
    <div className="space-y-6">
      {/* Threshold / toolbar */}
      <div id="signals-top" />
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Sliders className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Confidence Threshold</p>
              <p className="text-xs text-muted-foreground">
                Show signals ≥ {threshold}% confidence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-40">
              <Slider value={[threshold]} min={50} max={95} step={1} onValueChange={(v) => setThreshold(v[0])} />
            </div>
            <Badge variant="secondary" className="bg-primary/15 px-3 py-1 text-primary">
              {loading ? '…' : filtered.length} active
            </Badge>
            {lastScan && !loading && (
              <span className="hidden text-[11px] text-muted-foreground sm:block">
                Scanned {timeAgo(lastScan.toISOString())}
              </span>
            )}
            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={scan} disabled={loading}>
              {loading
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              {loading ? 'Scanning…' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Signal list */}
        <div className="space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live Signals
            </p>
            {loading && (
              <span className="flex items-center gap-1.5 text-[11px] text-primary">
                <Radio className="h-3 w-3 animate-pulse" /> Scanning markets…
              </span>
            )}
          </div>

          {/* Loading skeleton */}
          {loading && signals.length === 0 && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-secondary" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-20 rounded bg-secondary" />
                        <div className="h-2.5 w-28 rounded bg-secondary" />
                      </div>
                    </div>
                    <div className="h-11 w-11 rounded-full bg-secondary" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 w-24 rounded bg-secondary" />
                    <div className="h-3 w-16 rounded bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No signals */}
          {!loading && filtered.length === 0 && (
            <div className="rounded-lg border border-border bg-secondary/30 p-8 text-center">
              <Radio className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium">No signals above {threshold}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Lower the threshold or refresh to scan again.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={scan}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Scan now
              </Button>
            </div>
          )}

          {/* Signal cards */}
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={cn(
                'w-full rounded-lg border bg-card p-4 text-left transition-all',
                selected?.id === s.id
                  ? 'border-primary/50 ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      s.direction === 'LONG' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    )}
                  >
                    {s.direction === 'LONG'
                      ? <TrendingUp className="h-4 w-4" />
                      : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{s.symbol}</p>
                    <p className="text-[10px] text-muted-foreground">{s.timeframe} · {s.holdingTime}</p>
                  </div>
                </div>
                <ConfidenceRing value={s.confidence} size={44} stroke={3.5} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Entry{' '}
                  <span className="font-mono font-semibold text-foreground">
                    ${formatPrice(s.entry)}
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'px-1.5 py-0 text-[10px]',
                    s.direction === 'LONG'
                      ? 'border-success/40 text-success'
                      : 'border-destructive/40 text-destructive'
                  )}
                >
                  {s.direction}
                </Badge>
                <span className="text-muted-foreground">RR {s.riskReward}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <CategoryBadge label="Scalp" value={s.scalpingConfidence} />
                <CategoryBadge label="Day" value={s.dayConfidence} />
                <CategoryBadge label="Swing" value={s.swingConfidence} />
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {loading && !selected ? (
            <Card>
              <CardContent className="flex min-h-[480px] flex-col items-center justify-center gap-3 text-center">
                <div className="relative">
                  <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  <Radio className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">Scanning live market data…</p>
                <p className="text-xs text-muted-foreground">
                  Fetching real-time prices & computing indicators for all 15 pairs
                </p>
              </CardContent>
            </Card>
          ) : selected ? (
            <SignalDetail key={selected.id} signal={selected} />
          ) : (
            <Card>
              <CardContent className="flex min-h-[480px] items-center justify-center text-sm text-muted-foreground">
                Select a signal to view the full trade setup
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <DisclaimerBanner />
    </div>
  );
}

function SignalDetail({ signal }: { signal: TradeSignal }) {
  const isLong = signal.direction === 'LONG';
  return (
    <Card className="animate-fade-in">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center justify-between">
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
                {signal.symbol}
                <Badge
                  variant="outline"
                  className={cn(
                    'px-2 py-0.5 text-xs font-bold',
                    isLong ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'
                  )}
                >
                  {signal.direction}
                </Badge>
                <Badge variant="outline" className="border-success/40 text-[10px] text-success">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success" /> Live
                </Badge>
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {signal.timeframe} timeframe · Generated {timeAgo(signal.createdAt)}
              </p>
            </div>
          </div>
          <ConfidenceRing value={signal.confidence} size={64} stroke={5} label="conf" />
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <PriceLevel label="Entry" value={signal.entry} icon={Activity} tone="primary" />
          <PriceLevel label="Stop Loss" value={signal.stopLoss} icon={ShieldAlert} tone="destructive" />
          <PriceLevel label="Exit Target" value={signal.exit} icon={Target} tone="success" />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Take Profit Levels
          </p>
          <div className="grid grid-cols-3 gap-3">
            <TpLevel level="TP1" value={signal.tp1} pct={pctFromEntry(signal.entry, signal.tp1, isLong)} />
            <TpLevel level="TP2" value={signal.tp2} pct={pctFromEntry(signal.entry, signal.tp2, isLong)} />
            <TpLevel level="TP3" value={signal.tp3} pct={pctFromEntry(signal.entry, signal.tp3, isLong)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Risk / Reward" value={signal.riskReward} icon={Target} />
          <Metric label="Position Size" value={signal.positionSize} icon={Activity} small />
          <Metric label="Holding Time" value={signal.holdingTime} icon={Clock} small />
          <Metric label="Trailing Stop" value={signal.trailingStop} icon={ShieldAlert} small />
        </div>

        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Zap className="h-3.5 w-3.5" /> AI Signal Confluence
          </p>
          <ul className="space-y-2">
            {signal.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Activity className="h-3.5 w-3.5" /> Trade Category Breakdown
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CategoryCard label="Scalping" timeframe="15M" confidence={signal.scalpingConfidence} />
            <CategoryCard label="Day Trade" timeframe="1H" confidence={signal.dayConfidence} />
            <CategoryCard label="Swing Trade" timeframe="4H" confidence={signal.swingConfidence} />
          </div>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            <Zap className="mr-2 h-4 w-4" /> Log to Journal
          </Button>
          <Button variant="outline" className="flex-1">
            Set Price Alert
          </Button>
        </div>
      </CardContent>
    </Card>
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

function pctFromEntry(entry: number, target: number, isLong: boolean): string {
  const pct = ((target - entry) / entry) * 100 * (isLong ? 1 : -1);
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function CategoryBadge({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 75 ? 'border-success/40 text-success' :
    value >= 60 ? 'border-primary/40 text-primary' :
    'border-muted-foreground/30 text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium', tone)}>
      {label} <span className="font-mono font-bold">{value}%</span>
    </span>
  );
}

function CategoryCard({ label, timeframe, confidence }: { label: string; timeframe: string; confidence: number }) {
  const tone =
    confidence >= 75 ? 'border-success/40 bg-success/5 text-success' :
    confidence >= 60 ? 'border-primary/40 bg-primary/5 text-primary' :
    'border-border bg-secondary/50 text-muted-foreground';
  return (
    <div className={cn('rounded-lg border p-3', tone)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{timeframe} timeframe</p>
      <p className="mt-1.5 font-mono text-xl font-bold">{confidence}%</p>
    </div>
  );
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m ago`;
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}
