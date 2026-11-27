import {
  calcRSI,
  calcEMA,
  calcMACD,
  calcATR,
  calcBollingerBands,
  calcVWAP,
  detectBOS,
  findSupportResistance,
  detectRSIDivergence,
  calcStochRSI,
  calcADX,
  detectVolumeSpike,
  detectOrderBlock,
  calcFibonacci,
  detectMarketRegime,
} from './indicators';
import type { Coin, TradeSignal } from './types';
import { fetchKlinesDirect } from './binance-direct';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchKlines(binanceSymbol: string, timeframe: string): Promise<Candle[]> {
  // Direct Binance — Supabase Edge Function 402/quota ka bypass.
  try {
    return await fetchKlinesDirect(binanceSymbol, timeframe);
  } catch {
    return [];
  }
}

interface IndicatorRead {
  rsi: number;
  stochRSI: { k: number; d: number; signal: 'bullish' | 'bearish' | 'neutral' };
  macd: { signal: 'bullish' | 'bearish' | 'neutral'; value: string; histogram: number };
  atr: number;
  bb: { upper: number; middle: number; lower: number; pct: number };
  vwap: number;
  bos: 'bullish' | 'bearish' | 'neutral';
  emaBull: boolean;
  emaBear: boolean;
  adx: { adx: number; plusDI: number; minusDI: number; trend: string };
  sr: { support: number; resistance: number };
  price: number;
  atrRatio: number;
  divergence: 'bullish' | 'bearish' | 'none';
  volumeSpike: { isSpike: boolean; ratio: number };
  orderBlocks: { bullish: { price: number; strength: number } | null; bearish: { price: number; strength: number } | null };
  fib: { levels: { level: string; price: number; ratio: number }[]; swingHigh: number; swingLow: number; direction: 'up' | 'down' };
  regime: { regime: string; volatility: number; trendStrength: number };
}

function computeIndicators(candles: Candle[]): IndicatorRead | null {
  if (candles.length < 50) return null;

  const closes = candles.map((c) => c.close);
  const highs  = candles.map((c) => c.high);
  const lows   = candles.map((c) => c.low);
  const price  = closes[closes.length - 1];

  const rsi      = calcRSI(closes, 14);
  const stochRSI = calcStochRSI(closes);
  const macd     = calcMACD(closes);
  const atr      = calcATR(highs, lows, closes, 14);
  const bb       = calcBollingerBands(closes, 20, 2);
  const vwap     = calcVWAP(candles.slice(-20));
  const bos      = detectBOS(closes);
  const ema9     = calcEMA(closes, 9);
  const ema50    = calcEMA(closes, 50);
  const emaBull  = ema9[ema9.length - 1] > ema50[ema50.length - 1];
  const emaBear  = ema9[ema9.length - 1] < ema50[ema50.length - 1];
  const adx      = calcADX(highs, lows, closes, 14);
  const sr       = findSupportResistance(candles);
  const atrRatio = atr / price;
  const divergence  = detectRSIDivergence(closes, rsi);
  const volumeSpike = detectVolumeSpike(candles);
  const orderBlocks = detectOrderBlock(candles);
  const fib         = calcFibonacci(candles);
  const regime      = detectMarketRegime(closes);

  return {
    rsi, stochRSI, macd, atr, bb, vwap, bos, emaBull, emaBear,
    adx, sr, price, atrRatio, divergence, volumeSpike, orderBlocks, fib, regime,
  };
}

interface TFRead {
  label: string;
  tf: string;
  ind: IndicatorRead | null;
}

async function analyzeTimeframes(coin: Coin): Promise<{
  primary: IndicatorRead;
  secondary: IndicatorRead | null;
  tertiary: IndicatorRead | null;
  tfLabel: string;
  tfCode: string;
} | null> {
  const binanceSymbol = coin.symbol.replace('/', '');
  const [c4h, c1h, c15] = await Promise.all([
    fetchKlines(binanceSymbol, '240').catch(() => []),
    fetchKlines(binanceSymbol, '60').catch(() => []),
    fetchKlines(binanceSymbol, '15').catch(() => []),
  ]);

  const primary = computeIndicators(c4h);
  if (!primary) return null;
  const secondary = computeIndicators(c1h);
  const tertiary = computeIndicators(c15);

  return { primary, secondary, tertiary, tfLabel: '4H', tfCode: '240' };
}

interface ConfluenceResult {
  bull: number;
  bear: number;
  reasons: string[];
  confluenceCount: number;
}

function scoreConfluence(ind: IndicatorRead, label: string): ConfluenceResult {
  let bull = 0;
  let bear = 0;
  const reasons: string[] = [];
  let confluenceCount = 0;

  // 1. EMA trend (weight: 3)
  if (ind.emaBull) { bull += 3; confluenceCount++; }
  if (ind.emaBear) { bear += 3; confluenceCount++; }

  // 2. BOS structure (weight: 4)
  if (ind.bos === 'bullish') { bull += 4; confluenceCount++; reasons.push(`${label} bullish BOS confirmed`); }
  if (ind.bos === 'bearish') { bear += 4; confluenceCount++; reasons.push(`${label} bearish BOS confirmed`); }

  // 3. MACD (weight: 3)
  if (ind.macd.signal === 'bullish') { bull += 3; confluenceCount++; reasons.push(`${label} MACD bullish`); }
  if (ind.macd.signal === 'bearish') { bear += 3; confluenceCount++; reasons.push(`${label} MACD bearish`); }

  // 4. RSI zone (weight: 2)
  if (ind.rsi > 50 && ind.rsi < 70) { bull += 2; confluenceCount++; }
  if (ind.rsi < 50 && ind.rsi > 30) { bear += 2; confluenceCount++; }
  if (ind.rsi < 30) { bull += 2; confluenceCount++; reasons.push(`${label} RSI oversold (${ind.rsi.toFixed(0)}) — reversal potential`); }
  if (ind.rsi > 70) { bear += 2; confluenceCount++; reasons.push(`${label} RSI overbought (${ind.rsi.toFixed(0)}) — pullback risk`); }

  // 5. StochRSI (weight: 2)
  if (ind.stochRSI.signal === 'bullish') { bull += 2; confluenceCount++; reasons.push(`${label} StochRSI bullish crossover`); }
  if (ind.stochRSI.signal === 'bearish') { bear += 2; confluenceCount++; reasons.push(`${label} StochRSI bearish crossover`); }

  // 6. VWAP (weight: 1)
  if (ind.price > ind.vwap) { bull += 1; confluenceCount++; }
  if (ind.price < ind.vwap) { bear += 1; confluenceCount++; }

  // 7. Bollinger Bands (weight: 2)
  if (ind.bb.pct < 0.25) { bull += 2; confluenceCount++; reasons.push(`${label} price near lower BB — mean reversion setup`); }
  if (ind.bb.pct > 0.75) { bear += 2; confluenceCount++; reasons.push(`${label} price near upper BB — rejection risk`); }

  // 8. ADX trend strength (weight: 3)
  if (ind.adx.adx > 25) {
    if (ind.adx.plusDI > ind.adx.minusDI) { bull += 3; confluenceCount++; reasons.push(`${label} ADX ${ind.adx.adx.toFixed(0)} — strong uptrend`); }
    else { bear += 3; confluenceCount++; reasons.push(`${label} ADX ${ind.adx.adx.toFixed(0)} — strong downtrend`); }
  }

  // 9. RSI Divergence (weight: 4 — high-value signal)
  if (ind.divergence === 'bullish') { bull += 4; confluenceCount++; reasons.push(`${label} bullish RSI divergence — momentum shift`); }
  if (ind.divergence === 'bearish') { bear += 4; confluenceCount++; reasons.push(`${label} bearish RSI divergence — momentum fade`); }

  // 10. Volume spike confirmation (weight: 2)
  if (ind.volumeSpike.isSpike) {
    confluenceCount++;
    if (ind.bos === 'bullish' || ind.macd.signal === 'bullish') { bull += 2; reasons.push(`${label} volume spike (${ind.volumeSpike.ratio.toFixed(1)}x avg) confirms bullish move`); }
    else if (ind.bos === 'bearish' || ind.macd.signal === 'bearish') { bear += 2; reasons.push(`${label} volume spike (${ind.volumeSpike.ratio.toFixed(1)}x avg) confirms bearish move`); }
  }

  // 11. Order block proximity (weight: 2)
  if (ind.orderBlocks.bullish && Math.abs(ind.price - ind.orderBlocks.bullish.price) / ind.price < 0.01) {
    bull += 2; confluenceCount++; reasons.push(`${label} price near bullish order block at ${ind.orderBlocks.bullish.price.toFixed(4)}`);
  }
  if (ind.orderBlocks.bearish && Math.abs(ind.price - ind.orderBlocks.bearish.price) / ind.price < 0.01) {
    bear += 2; confluenceCount++; reasons.push(`${label} price near bearish order block at ${ind.orderBlocks.bearish.price.toFixed(4)}`);
  }

  // 12. Fibonacci key levels (weight: 2)
  const fib618 = ind.fib.levels.find(l => l.ratio === 0.618);
  if (fib618 && Math.abs(ind.price - fib618.price) / ind.price < 0.005) {
    confluenceCount++;
    if (ind.fib.direction === 'up') { bull += 2; reasons.push(`${label} price at golden ratio (0.618) Fib retracement`); }
    else { bear += 2; reasons.push(`${label} price at golden ratio (0.618) Fib retracement`); }
  }

  return { bull, bear, reasons, confluenceCount };
}

function calcConfidence(
  primary: IndicatorRead,
  secondary: IndicatorRead | null,
  tertiary: IndicatorRead | null,
  direction: 'LONG' | 'SHORT',
  primaryConfluence: ConfluenceResult,
): number {
  const favor = direction === 'LONG' ? primaryConfluence.bull : primaryConfluence.bear;
  const against = direction === 'LONG' ? primaryConfluence.bear : primaryConfluence.bull;
  const net = favor - against;

  let score = 40 + net * 3 + Math.min(favor, 12);
  score += Math.min(primaryConfluence.confluenceCount * 1.5, 15);

  if (secondary) {
    if (direction === 'LONG' && secondary.emaBull) score += 6;
    if (direction === 'SHORT' && secondary.emaBear) score += 6;
    if (direction === 'LONG' && secondary.bos === 'bullish') score += 5;
    if (direction === 'SHORT' && secondary.bos === 'bearish') score += 5;
    if (direction === 'LONG' && secondary.macd.signal === 'bullish') score += 4;
    if (direction === 'SHORT' && secondary.macd.signal === 'bearish') score += 4;
    if (direction === 'LONG' && secondary.adx.trend === 'strong-up') score += 5;
    if (direction === 'SHORT' && secondary.adx.trend === 'strong-down') score += 5;
  }

  if (tertiary) {
    if (direction === 'LONG' && tertiary.emaBull) score += 3;
    if (direction === 'SHORT' && tertiary.emaBear) score += 3;
    if (direction === 'LONG' && tertiary.bos === 'bullish') score += 3;
    if (direction === 'SHORT' && tertiary.bos === 'bearish') score += 3;
  }

  if (primary && secondary && tertiary) {
    const allBull = primary.emaBull && secondary.emaBull && tertiary.emaBull;
    const allBear = primary.emaBear && secondary.emaBear && tertiary.emaBear;
    if (direction === 'LONG' && allBull) score += 10;
    if (direction === 'SHORT' && allBear) score += 10;
  }

  if (primary.regime.regime === 'volatile') score -= 5;
  if (primary.regime.regime === 'ranging' && direction === 'LONG') score -= 3;
  if (primary.volumeSpike.isSpike) score += 4;
  if (direction === 'LONG' && primary.divergence === 'bullish') score += 6;
  if (direction === 'SHORT' && primary.divergence === 'bearish') score += 6;

  return Math.min(97, Math.max(50, Math.round(score)));
}

function calcCategoryConfidence(
  core: IndicatorRead,
  faster: IndicatorRead | null,
  slower: IndicatorRead | null,
  direction: 'LONG' | 'SHORT',
  coreConfluence: ConfluenceResult,
): number {
  const favor = direction === 'LONG' ? coreConfluence.bull : coreConfluence.bear;
  const against = direction === 'LONG' ? coreConfluence.bear : coreConfluence.bull;
  const net = favor - against;

  let score = 38 + net * 3 + Math.min(favor, 10);
  score += Math.min(coreConfluence.confluenceCount * 1.5, 12);

  if (faster) {
    if (direction === 'LONG' && faster.emaBull) score += 4;
    if (direction === 'SHORT' && faster.emaBear) score += 4;
    if (direction === 'LONG' && faster.bos === 'bullish') score += 3;
    if (direction === 'SHORT' && faster.bos === 'bearish') score += 3;
    if (direction === 'LONG' && faster.macd.signal === 'bullish') score += 3;
    if (direction === 'SHORT' && faster.macd.signal === 'bearish') score += 3;
  }

  if (slower) {
    if (direction === 'LONG' && slower.emaBull) score += 5;
    if (direction === 'SHORT' && slower.emaBear) score += 5;
    if (direction === 'LONG' && slower.bos === 'bullish') score += 4;
    if (direction === 'SHORT' && slower.bos === 'bearish') score += 4;
  }

  if (core && faster && slower) {
    const allBull = core.emaBull && faster.emaBull && slower.emaBull;
    const allBear = core.emaBear && faster.emaBear && slower.emaBear;
    if (direction === 'LONG' && allBull) score += 8;
    if (direction === 'SHORT' && allBear) score += 8;
  }

  if (core.regime.regime === 'volatile') score -= 4;
  if (core.volumeSpike.isSpike) score += 3;
  if (direction === 'LONG' && core.divergence === 'bullish') score += 5;
  if (direction === 'SHORT' && core.divergence === 'bearish') score += 5;

  return Math.min(97, Math.max(45, Math.round(score)));
}

async function analyzeOneCoin(coin: Coin): Promise<TradeSignal | null> {
  try {
    const result = await analyzeTimeframes(coin);
    if (!result) return null;
    const { primary: ind, secondary, tertiary, tfLabel } = result;

    const price = ind.price > 0 ? ind.price : coin.price;
    const vwapAbove = price > ind.vwap;

    const primaryConfluence = scoreConfluence(ind, '4H');

    if (primaryConfluence.bull < 5 && primaryConfluence.bear < 5) return null;

    let isLong: boolean;
    if (primaryConfluence.bull > primaryConfluence.bear) isLong = true;
    else if (primaryConfluence.bear > primaryConfluence.bull) isLong = false;
    else isLong = ind.emaBull;
    const direction: 'LONG' | 'SHORT' = isLong ? 'LONG' : 'SHORT';

    const confidence = calcConfidence(ind, secondary, tertiary, direction, primaryConfluence);

    // Per-category confidences: scalping (15M core), day trade (1H core), swing trade (4H core)
    const scalpingConfidence = tertiary
      ? calcCategoryConfidence(tertiary, ind, secondary, direction, scoreConfluence(tertiary, '15M'))
      : Math.round(confidence * 0.85);
    const dayConfidence = secondary
      ? calcCategoryConfidence(secondary, tertiary, ind, direction, scoreConfluence(secondary, '1H'))
      : Math.round(confidence * 0.92);
    const swingConfidence = calcCategoryConfidence(ind, secondary, tertiary, direction, primaryConfluence);

    // ATR-based stop with market regime awareness
    const atrMult = ind.regime.regime === 'volatile' ? 2.0 : 1.5;
    const slDist  = Math.max(ind.atr * atrMult, price * 0.005);
    const entry   = price;
    const stopLoss = isLong ? entry - slDist : entry + slDist;

    // Dynamic R/R targets based on ADX — stronger trends get wider targets
    const trendBoost = ind.adx.adx > 25 ? 0.5 : 0;
    const tp1Mult = 1.5 + trendBoost;
    const tp2Mult = 2.5 + trendBoost;
    const tp3Mult = 3.5 + trendBoost;

    const tp1 = isLong ? entry + slDist * tp1Mult : entry - slDist * tp1Mult;
    const tp2 = isLong ? entry + slDist * tp2Mult : entry - slDist * tp2Mult;
    const tp3 = isLong ? entry + slDist * tp3Mult : entry - slDist * tp3Mult;
    const rr = `1:${(Math.abs(tp3 - entry) / slDist).toFixed(1)}`;

    const reasons: string[] = [];

    // Primary timeframe reasons from confluence
    reasons.push(...primaryConfluence.reasons);

    // VWAP bias
    if (vwapAbove && isLong) reasons.push('Price above VWAP — bullish intraday bias');
    if (!vwapAbove && !isLong) reasons.push('Price below VWAP — bearish intraday bias');

    // Multi-timeframe confirmation
    if (secondary) {
      if (isLong && secondary.emaBull) reasons.push('1H EMA alignment confirms bullish bias');
      if (!isLong && secondary.emaBear) reasons.push('1H EMA alignment confirms bearish bias');
      if (isLong && secondary.bos === 'bullish') reasons.push('1H BOS confirms 4H direction');
      if (!isLong && secondary.bos === 'bearish') reasons.push('1H BOS confirms 4H direction');
      if (isLong && secondary.adx.trend === 'strong-up') reasons.push('1H ADX confirms strong uptrend');
      if (!isLong && secondary.adx.trend === 'strong-down') reasons.push('1H ADX confirms strong downtrend');
    }

    if (tertiary) {
      if (isLong && tertiary.emaBull) reasons.push('15M EMA aligned bullish — precision entry timing');
      if (!isLong && tertiary.emaBear) reasons.push('15M EMA aligned bearish — precision entry timing');
    }

    // Three-timeframe alignment
    if (secondary && tertiary) {
      const allBull = ind.emaBull && secondary.emaBull && tertiary.emaBull;
      const allBear = ind.emaBear && secondary.emaBear && tertiary.emaBear;
      if (isLong && allBull) reasons.push('Full 3-timeframe EMA alignment (15M/1H/4H) — high-conviction setup');
      if (!isLong && allBear) reasons.push('Full 3-timeframe EMA alignment (15M/1H/4H) — high-conviction setup');
    }

    // Market regime
    reasons.push(`Market regime: ${ind.regime.regime} — ${ind.regime.regime === 'trending' ? 'trend-following optimal' : ind.regime.regime === 'volatile' ? 'reduce position size' : 'range-trading preferred'}`);

    // ATR and RSI summary
    reasons.push(`ATR ${(ind.atrRatio * 100).toFixed(2)}% — ${ind.atrRatio > 0.03 ? 'elevated' : 'normal'} volatility`);
    reasons.push(`RSI (14): ${ind.rsi.toFixed(1)} | StochRSI K: ${ind.stochRSI.k.toFixed(1)} — ${ind.rsi > 55 ? 'bullish momentum' : ind.rsi < 45 ? 'bearish pressure' : 'neutral zone'}`);

    // Support/resistance context
    reasons.push(`Key support: $${ind.sr.support.toFixed(4)} | Key resistance: $${ind.sr.resistance.toFixed(4)}`);

    // Position sizing based on confidence and volatility
    const baseSize = (confidence / 100) * 2.5;
    const volAdjust = ind.regime.regime === 'volatile' ? 0.7 : 1;
    const positionSize = `${(baseSize * volAdjust).toFixed(1)}% of portfolio`;

    // Trailing stop based on ATR and regime
    const trailMult = ind.regime.regime === 'volatile' ? 1.5 : 1.2;
    const trailingStop = `Activate after TP1 — trail by ${(ind.atrRatio * 100 * trailMult).toFixed(1)}% (ATR-based)`;

    // Holding time based on ADX trend strength
    const holdingTime = ind.adx.adx > 25 ? '8–48 hours' : '4–18 hours';

    return {
      id: `sig-${coin.symbol.replace('/', '')}-${Date.now()}`,
      symbol: coin.symbol,
      direction,
      confidence,
      entry,
      exit: tp3,
      tp1,
      tp2,
      tp3,
      stopLoss,
      trailingStop,
      riskReward: rr,
      positionSize,
      holdingTime,
      timeframe: tfLabel as any,
      createdAt: new Date().toISOString(),
      reasons,
      status: 'active',
      scalpingConfidence,
      dayConfidence,
      swingConfidence,
    };
  } catch {
    return null;
  }
}

export async function generateSignals(
  coins: Coin[],
  threshold = 65,
  _timeframe = '240'
): Promise<TradeSignal[]> {
  const results = await Promise.allSettled(coins.map((coin) => analyzeOneCoin(coin)));

  const signals: TradeSignal[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      const sig = result.value;
      if (sig.confidence >= threshold) {
        signals.push(sig);
      }
    }
  }

  return signals.sort((a, b) => b.confidence - a.confidence);
}
