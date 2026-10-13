'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LineChart as LineChartIcon,
  Layers,
  CandlestickChart,
  BarChart3,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CandleChart } from '@/components/candle-chart';
import { TIMEFRAMES } from '@/lib/market-data';
import { useLiveKlines, formatPrice } from '@/lib/use-live-market';
import {
  calcRSI,
  calcMACD,
  calcATR,
  calcBollingerBands,
  calcVWAP,
  calcEMA,
  detectBOS,
  findSupportResistance,
} from '@/lib/indicators';
import type { Timeframe, IndicatorReading, SMCReading } from '@/lib/types';
import { cn } from '@/lib/utils';

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT', 'AVAX/USDT', 'LINK/USDT'];

export function TechnicalView() {
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('4H');
  const { candles, loading } = useLiveKlines(symbol, timeframe);

  const indicators = useMemo<IndicatorReading[]>(() => {
    if (candles.length < 30) return [];
    return calcIndicators(candles);
  }, [candles]);

  const smc = useMemo<SMCReading[]>(() => {
    if (candles.length < 20) return [];
    return calcSMC(candles);
  }, [candles]);

  const priceAction = useMemo(() => {
    if (candles.length < 20) return [];
    return calcPriceAction(candles);
  }, [candles]);

  const bullCount = indicators.filter((i) => i.signal === 'bullish').length;
  const bearCount = indicators.filter((i) => i.signal === 'bearish').length;
  const overall = bullCount > bearCount ? 'bullish' : bearCount > bullCount ? 'bearish' : 'neutral';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                symbol === s
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                timeframe === tf
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CandlestickChart className="h-4 w-4 text-primary" />
              {symbol} · {timeframe}
            </CardTitle>
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Badge variant="outline" className="text-[10px] font-normal border-success/40 text-success">
                Live
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'px-2 py-0.5 text-xs font-bold capitalize',
                  overall === 'bullish' && 'border-success/40 text-success',
                  overall === 'bearish' && 'border-destructive/40 text-destructive',
                  overall === 'neutral' && 'text-muted-foreground'
                )}
              >
                {overall} bias
              </Badge>
              <span className="text-xs text-muted-foreground">
                {bullCount} bull / {bearCount} bear
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-background/50 p-2">
              {candles.length > 0 ? (
                <CandleChart candles={candles} height={360} />
              ) : (
                <div className="flex h-[360px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-success" /> Bullish candle
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-destructive" /> Bearish candle
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> Volume
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChartIcon className="h-4 w-4 text-accent" />
              Indicator Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {indicators.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              indicators.map((ind) => (
                <div
                  key={ind.name}
                  className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
                >
                  <span className="text-xs font-medium">{ind.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{ind.value}</span>
                    <SignalDot signal={ind.signal} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" />
              Smart Money Concepts (SMC)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {smc.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              smc.map((s) => (
                <div key={s.label} className="rounded-md border border-border bg-secondary/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-1 text-sm font-medium">{s.status}</p>
                  <div className="mt-1.5">
                    <SignalDot signal={s.direction} withLabel />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CandlestickChart className="h-4 w-4 text-accent" />
              Price Action
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {priceAction.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              priceAction.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
                >
                  <span className="text-xs font-medium">{p.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{p.detail}</span>
                    <SignalDot signal={p.signal} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignalDot({
  signal,
  withLabel,
}: {
  signal: 'bullish' | 'bearish' | 'neutral';
  withLabel?: boolean;
}) {
  const Icon = signal === 'bullish' ? CheckCircle2 : signal === 'bearish' ? XCircle : MinusCircle;
  const color =
    signal === 'bullish' ? 'text-success' : signal === 'bearish' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <span className={cn('flex items-center gap-1 text-[11px] font-medium capitalize', color)}>
      <Icon className="h-3.5 w-3.5" />
      {withLabel && signal}
    </span>
  );
}

function calcIndicators(candles: { open: number; high: number; low: number; close: number; volume: number }[]): IndicatorReading[] {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const price = closes[closes.length - 1];

  const rsi = calcRSI(closes, 14);
  const macd = calcMACD(closes);
  const atr = calcATR(highs, lows, closes, 14);
  const bb = calcBollingerBands(closes, 20, 2);
  const vwap = calcVWAP(candles.slice(-20));
  const ema9 = calcEMA(closes, 9);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const ema100 = calcEMA(closes, 100);
  const ema200 = calcEMA(closes, 200);

  const ema9Bull = price > ema9[ema9.length - 1];
  const ema20Bull = ema9[ema9.length - 1] > ema20[ema20.length - 1];
  const ema50Bull = ema20[ema20.length - 1] > ema50[ema50.length - 1];
  const ema100Bull = ema50[ema50.length - 1] > ema100[ema100.length - 1];
  const ema200Bull = price > ema200[ema200.length - 1];
  const vwapAbove = price > vwap;

  return [
    { name: 'RSI (14)', value: rsi.toFixed(1), signal: rsi > 70 ? 'bearish' : rsi < 30 ? 'bullish' : 'neutral' },
    { name: 'MACD', value: macd.value, signal: macd.signal },
    { name: 'EMA 9', value: ema9Bull ? 'Price above' : 'Price below', signal: ema9Bull ? 'bullish' : 'bearish' },
    { name: 'EMA 20', value: ema20Bull ? 'EMA9 above' : 'EMA9 below', signal: ema20Bull ? 'bullish' : 'bearish' },
    { name: 'EMA 50', value: ema50Bull ? 'EMA20 above' : 'EMA20 below', signal: ema50Bull ? 'bullish' : 'bearish' },
    { name: 'EMA 100', value: ema100Bull ? 'EMA50 above' : 'EMA50 below', signal: ema100Bull ? 'bullish' : 'bearish' },
    { name: 'EMA 200', value: ema200Bull ? 'Price above' : 'Price below', signal: ema200Bull ? 'bullish' : 'bearish' },
    {
      name: 'Bollinger Bands',
      value: bb.pct > 0.7 ? 'Upper band' : bb.pct < 0.3 ? 'Lower band' : 'Mid-range',
      signal: bb.pct > 0.8 ? 'bearish' : bb.pct < 0.2 ? 'bullish' : 'neutral',
    },
    { name: 'VWAP', value: vwapAbove ? 'Price above' : 'Price below', signal: vwapAbove ? 'bullish' : 'bearish' },
    { name: 'ATR (14)', value: `${atr.toFixed(2)} (${((atr / price) * 100).toFixed(2)}%)`, signal: 'neutral' },
    {
      name: 'Volume Profile',
      value: `VWAP at $${formatPrice(vwap)}`,
      signal: vwapAbove ? 'bullish' : 'bearish',
    },
  ];
}

function calcSMC(candles: { open: number; high: number; low: number; close: number; volume: number }[]): SMCReading[] {
  const closes = candles.map((c) => c.close);
  const bos = detectBOS(closes);
  const sr = findSupportResistance(candles);
  const price = closes[closes.length - 1];

  // Detect order block: last opposite-color candle before a strong move
  const recent = candles.slice(-15);
  let obIdx = -1;
  for (let i = recent.length - 2; i >= 0; i--) {
    const move = Math.abs(recent[i + 1].close - recent[i + 1].open) / recent[i + 1].open;
    if (move > 0.01) {
      obIdx = i;
      break;
    }
  }
  const obBull = obIdx >= 0 && recent[obIdx].close < recent[obIdx].open;

  // FVG: gap between candle i-1 high and candle i+1 low (3-candle pattern)
  let fvgFound = false;
  let fvgBull = false;
  for (let i = recent.length - 3; i >= 0; i--) {
    if (recent[i + 2].low > recent[i].high) {
      fvgFound = true;
      fvgBull = true;
      break;
    }
    if (recent[i + 2].high < recent[i].low) {
      fvgFound = true;
      fvgBull = false;
      break;
    }
  }

  // Liquidity: check if recent high/low was swept
  const recentHigh = Math.max(...recent.slice(0, -1).map((c) => c.high));
  const recentLow = Math.min(...recent.slice(0, -1).map((c) => c.low));
  const sweptHigh = price > recentHigh;
  const sweptLow = price < recentLow;

  return [
    {
      label: 'Order Block (OB)',
      status: obIdx >= 0 ? `${obBull ? 'Bullish' : 'Bearish'} OB at $${formatPrice(obBull ? recent[obIdx].low : recent[obIdx].high)}` : 'No clear OB',
      direction: obIdx >= 0 ? (obBull ? 'bullish' : 'bearish') : 'neutral',
    },
    {
      label: 'Fair Value Gap (FVG)',
      status: fvgFound ? `${fvgBull ? 'Bullish' : 'Bearish'} FVG detected` : 'No FVG present',
      direction: fvgFound ? (fvgBull ? 'bullish' : 'bearish') : 'neutral',
    },
    {
      label: 'Liquidity Zones',
      status: sweptHigh ? 'Buy-side liquidity swept' : sweptLow ? 'Sell-side liquidity swept' : 'Liquidity intact',
      direction: sweptHigh ? 'bearish' : sweptLow ? 'bullish' : 'neutral',
    },
    {
      label: 'Break of Structure (BOS)',
      status: bos === 'bullish' ? 'Bullish BOS — higher high' : bos === 'bearish' ? 'Bearish BOS — lower low' : 'No BOS — ranging',
      direction: bos,
    },
    {
      label: 'Change of Character (CHOCH)',
      status: bos !== 'neutral' ? `${bos === 'bullish' ? 'Bullish' : 'Bearish'} CHOCH confirmed` : 'Awaiting confirmation',
      direction: bos,
    },
    {
      label: 'Market Structure Shift (MSS)',
      status: bos !== 'neutral' ? 'Structure shift detected' : 'No shift — trend intact',
      direction: bos,
    },
  ];
}

function calcPriceAction(candles: { open: number; high: number; low: number; close: number; volume: number }[]): {
  label: string;
  detail: string;
  signal: 'bullish' | 'bearish' | 'neutral';
}[] {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const sr = findSupportResistance(candles);
  const bos = detectBOS(closes);

  // Trend: compare first half avg vs second half avg
  const half = Math.floor(closes.length / 2);
  const firstAvg = closes.slice(0, half).reduce((s, v) => s + v, 0) / half;
  const secondAvg = closes.slice(half).reduce((s, v) => s + v, 0) / (closes.length - half);
  const uptrend = secondAvg > firstAvg;

  // Last candle pattern
  const last = candles[candles.length - 1];
  const bodySize = Math.abs(last.close - last.open);
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const isHammer = lowerWick > bodySize * 2 && upperWick < bodySize * 0.5;
  const isShootingStar = upperWick > bodySize * 2 && lowerWick < bodySize * 0.5;

  // Consolidation: check if recent range is tight
  const recent = candles.slice(-10);
  const range = Math.max(...recent.map((c) => c.high)) - Math.min(...recent.map((c) => c.low));
  const rangePct = (range / price) * 100;
  const consolidating = rangePct < 3;

  return [
    { label: 'Support & Resistance', detail: `Support $${formatPrice(sr.support)} / Resistance $${formatPrice(sr.resistance)}`, signal: price > (sr.support + sr.resistance) / 2 ? 'bullish' : 'bearish' },
    { label: 'Supply & Demand', detail: uptrend ? 'Demand zone holding' : 'Supply zone active', signal: uptrend ? 'bullish' : 'bearish' },
    { label: 'Trend Lines', detail: uptrend ? 'Ascending channel' : 'Descending channel', signal: uptrend ? 'bullish' : 'bearish' },
    { label: 'Chart Patterns', detail: bos !== 'neutral' ? 'Breakout pattern' : consolidating ? 'Consolidation pattern' : 'Trending pattern', signal: bos === 'bullish' ? 'bullish' : bos === 'bearish' ? 'bearish' : 'neutral' },
    { label: 'Candlestick Patterns', detail: isHammer ? 'Hammer at support' : isShootingStar ? 'Shooting star at resistance' : 'No strong pattern', signal: isHammer ? 'bullish' : isShootingStar ? 'bearish' : 'neutral' },
    { label: 'Consolidation', detail: consolidating ? 'Tight range — breakout pending' : 'No consolidation — trending', signal: 'neutral' },
    { label: 'Breakout / Retest', detail: bos !== 'neutral' ? 'Breakout confirmed' : 'No breakout', signal: bos === 'bullish' ? 'bullish' : bos === 'bearish' ? 'bearish' : 'neutral' },
  ];
}
