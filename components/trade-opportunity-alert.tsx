'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  X,
  ChevronRight,
  Activity,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateSignals } from '@/lib/signal-engine';
import { useLiveMarket, formatPrice } from '@/lib/use-live-market';
import type { TradeSignal, ViewKey } from '@/lib/types';
import { cn } from '@/lib/utils';

const HIGH_CONFIDENCE = 75;
const SCAN_INTERVAL = 60_000;

interface Props {
  onNavigate: (v: ViewKey) => void;
  onSelectSignal?: (s: TradeSignal) => void;
}

export function TradeOpportunityAlert({ onNavigate, onSelectSignal }: Props) {
  const coins = useLiveMarket(30000);
  const coinsRef = useRef(coins);
  useEffect(() => { coinsRef.current = coins; }, [coins]);

  const [topSignal, setTopSignal] = useState<TradeSignal | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(dismissed);

  useEffect(() => { dismissedRef.current = dismissed; }, [dismissed]);

  const scan = useCallback(async () => {
    try {
      const live = await generateSignals(coinsRef.current, HIGH_CONFIDENCE);
      const candidate = live.find((s) => !dismissedRef.current.has(s.id)) ?? null;
      if (candidate) {
        setTopSignal(candidate);
        setVisible(true);
      }
    } catch {
      // silent fail — alert is non-critical
    }
  }, []);

  useEffect(() => {
    scan();
    const t = setInterval(scan, SCAN_INTERVAL);
    return () => clearInterval(t);
  }, [scan]);

  const handleDismiss = () => {
    if (topSignal) {
      setDismissed((prev) => new Set(prev).add(topSignal.id));
    }
    setVisible(false);
  };

  const handleQuickTradePlan = () => {
    if (topSignal && onSelectSignal) {
      onSelectSignal(topSignal);
    }
    onNavigate('signals');
    setVisible(false);
  };

  if (!visible || !topSignal) return null;

  const isLong = topSignal.direction === 'LONG';

  return (
    <div className="animate-slide-down">
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border-2 shadow-lg',
          isLong
            ? 'border-success/50 bg-gradient-to-r from-success/15 via-success/8 to-transparent'
            : 'border-destructive/50 bg-gradient-to-r from-destructive/15 via-destructive/8 to-transparent'
        )}
      >
        {/* Pulsing accent bar */}
        <div
          className={cn(
            'absolute left-0 top-0 h-full w-1.5',
            isLong ? 'bg-success' : 'bg-destructive'
          )}
        />

        <div className="flex flex-col gap-3 p-4 pl-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: alert content */}
          <div className="flex items-start gap-3 sm:items-center">
            {/* Icon */}
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1',
                isLong
                  ? 'bg-success/20 text-success ring-success/30'
                  : 'bg-destructive/20 text-destructive ring-destructive/30'
              )}
            >
              {isLong
                ? <TrendingUp className="h-6 w-6" />
                : <TrendingDown className="h-6 w-6" />}
            </div>

            {/* Text */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-sm font-bold',
                    isLong ? 'text-success' : 'text-destructive'
                  )}
                >
                  <Zap className="h-4 w-4" />
                  Highly Probable Trade Opportunity Detected
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'px-1.5 py-0 text-[10px] font-bold',
                    isLong
                      ? 'border-success/40 text-success'
                      : 'border-destructive/40 text-destructive'
                  )}
                >
                  {topSignal.direction}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{topSignal.symbol}</span>
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Entry <span className="font-mono font-semibold text-foreground">${formatPrice(topSignal.entry)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  TP1 <span className="font-mono font-semibold text-success">${formatPrice(topSignal.tp1)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  SL <span className="font-mono font-semibold text-destructive">${formatPrice(topSignal.stopLoss)}</span>
                </span>
                <span>RR {topSignal.riskReward}</span>
                <span className="font-semibold text-primary">{topSignal.confidence}% confidence</span>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={handleQuickTradePlan}
              className={cn(
                'h-9 gap-1.5 font-semibold',
                isLong
                  ? 'bg-success text-success-foreground hover:bg-success/90'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              )}
            >
              <Zap className="h-4 w-4" />
              Quick Trade Plan
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
