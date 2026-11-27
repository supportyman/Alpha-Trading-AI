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
import type { Coin, ScannerResult, StrategyType, Timeframe, SignalDirection } from './types';
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

const TIMEFRAMES: Timeframe[] = ['15M', '1H', '4H', '1D', '1W'];
const TF_INTERVAL_MAP: Record<Timeframe, string> = {
  '1m': '1', '5m': '5', '15m': '15', '15M': '15', '1H': '60', '4H': '240', '1D': '1440', '1W': '10080',
};

async function fetchKlines(binanceSymbol: string, tf: Timeframe): Promise<Candle[]> {
  // Direct Binance public API (CORS *) — Supabase Edge Function quota se bachat.
  // Cache 60s, isliye 5 timeframes × 19 coins bhi sirf 95 requests, aur purani
  // calls cache se milti hain. Edge function ab fallback bhi nahi — 402 deta hai.
  try {
    return await fetchKlinesDirect(binanceSymbol, TF_INTERVAL_MAP[tf] || '240');
  } catch {
    return [];
  }
}

interface TFAnalysis {
  rsi: number;
  stochRSI: { k: number; d: number; signal: 'bullish' | 'bearish' | 'neutral' };
  macdSig: 'bullish' | 'bearish' | 'neutral';
  macdHist: number;
  bos: 'bullish' | 'bearish' | 'neutral';
  emaBull: boolean;
  emaBear: boolean;
  bbPct: number;
  vwapAbove: boolean;
  atrRatio: number;
  volume: number;
  sr: { support: number; resistance: number };
  price: number;
  closes: number[];
  adx: { adx: number; plusDI: number; minusDI: number; trend: 'strong-up' | 'strong-down' | 'weak' | 'ranging' };
  divergence: 'bullish' | 'bearish' | 'none';
  volumeSpike: { isSpike: boolean; ratio: number };
  orderBlocks: { bullish: { price: number; strength: number } | null; bearish: { price: number; strength: number } | null };
  fib: { levels: { level: string; price: number; ratio: number }[]; swingHigh: number; swingLow: number; direction: 'up' | 'down' };
  regime: { regime: 'trending' | 'ranging' | 'volatile'; volatility: number; trendStrength: number };
}

function analyzeTimeframe(candles: Candle[]): TFAnalysis | null {
  if (candles.length < 50) return null;
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const price = closes[closes.length - 1];

  const rsi = calcRSI(closes, 14);
  const stochRSI = calcStochRSI(closes);
  const macd = calcMACD(closes);
  const atr = calcATR(highs, lows, closes, 14);
  const bb = calcBollingerBands(closes, 20, 2);
  const vwap = calcVWAP(candles.slice(-20));
  const bos = detectBOS(closes);
  const ema9 = calcEMA(closes, 9);
  const ema50 = calcEMA(closes, 50);
  const emaBull = ema9[ema9.length - 1] > ema50[ema50.length - 1];
  const emaBear = ema9[ema9.length - 1] < ema50[ema50.length - 1];
  const vwapAbove = price > vwap;
  const atrRatio = atr / price;
  const volume = candles.slice(-5).reduce((s, c) => s + c.volume, 0) / 5;
  const sr = findSupportResistance(candles);
  const adx = calcADX(highs, lows, closes, 14);
  const divergence = detectRSIDivergence(closes, rsi);
  const volumeSpike = detectVolumeSpike(candles);
  const orderBlocks = detectOrderBlock(candles);
  const fib = calcFibonacci(candles);
  const regime = detectMarketRegime(closes);

  return {
    rsi, stochRSI, macdSig: macd.signal, macdHist: macd.histogram,
    bos, emaBull, emaBear, bbPct: bb.pct, vwapAbove, atrRatio, volume, sr, price, closes,
    adx, divergence, volumeSpike, orderBlocks, fib, regime,
  };
}

interface ConfluenceScore {
  bull: number;
  bear: number;
  count: number;
}

function confluence(tf: TFAnalysis): ConfluenceScore {
  let bull = 0;
  let bear = 0;
  let count = 0;

  if (tf.emaBull) { bull += 3; count++; }
  if (tf.emaBear) { bear += 3; count++; }
  if (tf.bos === 'bullish') { bull += 4; count++; }
  if (tf.bos === 'bearish') { bear += 4; count++; }
  if (tf.macdSig === 'bullish') { bull += 3; count++; }
  if (tf.macdSig === 'bearish') { bear += 3; count++; }
  if (tf.rsi > 50 && tf.rsi < 70) { bull += 2; count++; }
  if (tf.rsi < 50 && tf.rsi > 30) { bear += 2; count++; }
  if (tf.rsi < 30) { bull += 2; count++; }
  if (tf.rsi > 70) { bear += 2; count++; }
  if (tf.stochRSI.signal === 'bullish') { bull += 2; count++; }
  if (tf.stochRSI.signal === 'bearish') { bear += 2; count++; }
  if (tf.vwapAbove) { bull += 1; count++; }
  if (!tf.vwapAbove) { bear += 1; count++; }
  if (tf.bbPct < 0.25) { bull += 2; count++; }
  if (tf.bbPct > 0.75) { bear += 2; count++; }
  if (tf.adx.adx > 25) {
    if (tf.adx.plusDI > tf.adx.minusDI) { bull += 3; count++; }
    else { bear += 3; count++; }
  }
  if (tf.divergence === 'bullish') { bull += 4; count++; }
  if (tf.divergence === 'bearish') { bear += 4; count++; }
  if (tf.volumeSpike.isSpike) {
    count++;
    if (tf.bos === 'bullish' || tf.macdSig === 'bullish') bull += 2;
    else if (tf.bos === 'bearish' || tf.macdSig === 'bearish') bear += 2;
  }
  if (tf.orderBlocks.bullish && Math.abs(tf.price - tf.orderBlocks.bullish.price) / tf.price < 0.01) { bull += 2; count++; }
  if (tf.orderBlocks.bearish && Math.abs(tf.price - tf.orderBlocks.bearish.price) / tf.price < 0.01) { bear += 2; count++; }
  const fib618 = tf.fib.levels.find(l => l.ratio === 0.618);
  if (fib618 && Math.abs(tf.price - fib618.price) / tf.price < 0.005) {
    count++;
    if (tf.fib.direction === 'up') bull += 2;
    else bear += 2;
  }

  return { bull, bear, count };
}

function scoreScalping(tf15: TFAnalysis | null, tf1h: TFAnalysis | null, coin: Coin): number {
  if (!tf15 || !tf1h) return 0;
  const c15 = confluence(tf15);
  const c1h = confluence(tf1h);
  const favor = Math.max(c15.bull, c15.bear);
  let score = 35 + favor * 2;

  if (coin.volume24h > 500_000_000) score += 10;
  else if (coin.volume24h > 100_000_000) score += 7;
  else if (coin.volume24h > 20_000_000) score += 4;

  if (tf15.volumeSpike.isSpike) score += 8;
  if (tf15.adx.adx > 25) score += 6;
  if (tf15.divergence !== 'none') score += 6;
  if (tf1h.macdSig === tf15.macdSig && tf15.macdSig !== 'neutral') score += 8;
  if (tf15.atrRatio > 0.004 && tf15.atrRatio < 0.05) score += 6;
  if (tf15.vwapAbove) score += 5;
  score += Math.min(c15.count * 1.2, 12);

  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreDay(tf1h: TFAnalysis | null, tf4h: TFAnalysis | null, coin: Coin): number {
  if (!tf1h || !tf4h) return 0;
  const c4h = confluence(tf4h);
  const favor = Math.max(c4h.bull, c4h.bear);
  let score = 38 + favor * 2;

  if (tf4h.bos !== 'neutral') score += 12;
  if (tf4h.macdSig !== 'neutral') score += 10;
  if (tf4h.emaBull || tf4h.emaBear) score += 8;
  if (tf1h.macdSig === tf4h.macdSig && tf4h.macdSig !== 'neutral') score += 10;
  if (tf1h.bos === tf4h.bos && tf4h.bos !== 'neutral') score += 8;
  if (tf4h.adx.adx > 25) score += 8;
  if (tf4h.divergence !== 'none') score += 8;
  if (tf4h.volumeSpike.isSpike) score += 6;
  if (coin.volume24h > 100_000_000) score += 6;
  if (tf4h.atrRatio > 0.003 && tf4h.atrRatio < 0.06) score += 6;
  score += Math.min(c4h.count * 1.3, 14);

  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreSwing(tf4h: TFAnalysis | null, tf1d: TFAnalysis | null, tf1w: TFAnalysis | null, coin: Coin): number {
  if (!tf4h || !tf1d) return 0;
  const c1d = confluence(tf1d);
  const favor = Math.max(c1d.bull, c1d.bear);
  let score = 40 + favor * 2;

  if (tf1d.bos !== 'neutral') score += 14;
  if (tf1d.macdSig !== 'neutral') score += 10;
  if (tf1d.emaBull || tf1d.emaBear) score += 10;
  if (tf1w && tf1w.emaBull === tf1d.emaBull) score += 10;
  if (tf1w && tf1w.bos === tf1d.bos && tf1d.bos !== 'neutral') score += 8;
  if (tf4h.macdSig === tf1d.macdSig && tf1d.macdSig !== 'neutral') score += 8;
  if (tf1d.adx.adx > 25) score += 8;
  if (tf1d.divergence !== 'none') score += 8;
  if (coin.marketCap > 500_000_000) score += 6;
  if (tf1d.bbPct > 0.2 && tf1d.bbPct < 0.8) score += 6;
  if (tf1d.volumeSpike.isSpike) score += 5;
  score += Math.min(c1d.count * 1.3, 14);

  return Math.min(100, Math.max(0, Math.round(score)));
}

function calcOverallConfidence(
  scalping: number,
  day: number,
  swing: number,
  tf4h: TFAnalysis | null,
  tf1d: TFAnalysis | null,
  tf1h: TFAnalysis | null,
): number {
  const best = Math.max(scalping, day, swing);
  let conf = best;
  if (tf4h && tf1d) {
    if (tf4h.macdSig === tf1d.macdSig && tf4h.macdSig !== 'neutral') conf += 6;
    if (tf4h.bos === tf1d.bos && tf4h.bos !== 'neutral') conf += 5;
    if (tf4h.emaBull === tf1d.emaBull) conf += 4;
  }
  // 3-timeframe alignment bonus
  if (tf4h && tf1d && tf1h) {
    const allBull = tf4h.emaBull && tf1d.emaBull && tf1h.emaBull;
    const allBear = tf4h.emaBear && tf1d.emaBear && tf1h.emaBear;
    if (allBull || allBear) conf += 8;
  }
  // ADX trend strength bonus
  if (tf4h && tf4h.adx.adx > 30) conf += 5;
  // Divergence bonus
  if (tf4h && tf4h.divergence !== 'none') conf += 5;
  // Volume spike bonus
  if (tf4h && tf4h.volumeSpike.isSpike) conf += 4;
  return Math.min(97, Math.max(40, Math.round(conf)));
}

function relativeStrengthVsBTC(coinCloses: number[], btcCloses: number[] | null): number {
  if (!btcCloses || btcCloses.length < 10 || coinCloses.length < 10) return 50;
  const coinPct = ((coinCloses[coinCloses.length - 1] - coinCloses[coinCloses.length - 10]) / coinCloses[coinCloses.length - 10]) * 100;
  const btcPct = ((btcCloses[btcCloses.length - 1] - btcCloses[btcCloses.length - 10]) / btcCloses[btcCloses.length - 10]) * 100;
  const rs = coinPct - btcPct;
  return Math.max(0, Math.min(100, Math.round(50 + rs * 2)));
}

async function scanOneCoin(coin: Coin, btcCloses: number[] | null): Promise<ScannerResult | null> {
  const binanceSymbol = coin.symbol.replace('/', '');
  try {
    const [c15, c1h, c4h, c1d, c1w] = await Promise.all([
      fetchKlines(binanceSymbol, '15M').catch(() => []),
      fetchKlines(binanceSymbol, '1H').catch(() => []),
      fetchKlines(binanceSymbol, '4H').catch(() => []),
      fetchKlines(binanceSymbol, '1D').catch(() => []),
      fetchKlines(binanceSymbol, '1W').catch(() => []),
    ]);

    const tf15 = analyzeTimeframe(c15);
    const tf1h = analyzeTimeframe(c1h);
    const tf4h = analyzeTimeframe(c4h);
    const tf1d = analyzeTimeframe(c1d);
    const tf1w = analyzeTimeframe(c1w);

    if (!tf4h) return null;

    const scalpingScore = scoreScalping(tf15, tf1h, coin);
    const dayScore = scoreDay(tf1h, tf4h, coin);
    const swingScore = scoreSwing(tf4h, tf1d, tf1w, coin);

    const confidence = calcOverallConfidence(scalpingScore, dayScore, swingScore, tf4h, tf1d, tf1h);
    if (confidence < 65) return null;

    const scores = { scalping: scalpingScore, day: dayScore, swing: swingScore };
    const bestStrategy = (Object.keys(scores) as StrategyType[]).reduce((a, b) =>
      scores[a] >= scores[b] ? a : b
    );

    // Direction from primary timeframe with full confluence
    const primaryTF = bestStrategy === 'scalping' ? tf15 : bestStrategy === 'day' ? tf4h : tf1d;
    if (!primaryTF) return null;
    const pc = confluence(primaryTF);
    let isLong: boolean;
    if (pc.bull > pc.bear) isLong = true;
    else if (pc.bear > pc.bull) isLong = false;
    else isLong = tf4h.emaBull;
    const direction: SignalDirection = isLong ? 'LONG' : 'SHORT';

    const price = tf4h.price;
    const atrMult = tf4h.regime.regime === 'volatile' ? 2.0 : 1.5;
    const slDist = Math.max(tf4h.atrRatio * price * atrMult, price * 0.005);
    const entry = price;
    const stopLoss = isLong ? entry - slDist : entry + slDist;

    const trendBoost = tf4h.adx.adx > 25 ? 0.5 : 0;
    const tp1 = isLong ? entry + slDist * (1.5 + trendBoost) : entry - slDist * (1.5 + trendBoost);
    const tp2 = isLong ? entry + slDist * (2.5 + trendBoost) : entry - slDist * (2.5 + trendBoost);
    const tp3 = isLong ? entry + slDist * (3.5 + trendBoost) : entry - slDist * (3.5 + trendBoost);
    const rrNum = Math.abs(tp3 - entry) / slDist;
    const rr = `1:${rrNum.toFixed(1)}`;

    if (rrNum < 2) return null;

    const holdingTime =
      bestStrategy === 'scalping' ? '15 min – 2 hours' :
      bestStrategy === 'day' ? '2 – 12 hours' : '1 – 7 days';

    const leverage =
      bestStrategy === 'scalping' ? '5x – 10x' :
      bestStrategy === 'day' ? '3x – 5x' : '1x – 3x';

    const trailMult = tf4h.regime.regime === 'volatile' ? 1.5 : 1.2;
    const trailingStop = `Activate after TP1 — trail by ${(tf4h.atrRatio * 100 * trailMult).toFixed(1)}% (ATR-based)`;

    const rsVsBTC = relativeStrengthVsBTC(tf4h.closes, btcCloses);

    const analysis: string[] = [];

    // Market structure
    if (tf4h.bos === 'bullish') analysis.push('Market Structure is Bullish — BOS confirmed on 4H');
    else if (tf4h.bos === 'bearish') analysis.push('Market Structure is Bearish — BOS confirmed on 4H');
    else analysis.push('Market Structure is Neutral — no clear BOS on 4H');

    // MACD
    if (tf4h.macdSig === 'bullish') analysis.push('MACD bullish on 4H — momentum building');
    else if (tf4h.macdSig === 'bearish') analysis.push('MACD bearish on 4H — momentum fading');

    // EMA
    if (tf4h.emaBull) analysis.push('EMA 9 above EMA 50 — uptrend confirmed');
    else analysis.push('EMA 9 below EMA 50 — downtrend confirmed');

    // ADX trend strength
    if (tf4h.adx.adx > 25) {
      analysis.push(`ADX ${tf4h.adx.adx.toFixed(0)} — ${tf4h.adx.trend === 'strong-up' ? 'strong uptrend' : 'strong downtrend'} (+DI: ${tf4h.adx.plusDI.toFixed(0)} / -DI: ${tf4h.adx.minusDI.toFixed(0)})`);
    } else {
      analysis.push(`ADX ${tf4h.adx.adx.toFixed(0)} — weak/ranging market`);
    }

    // RSI + StochRSI
    analysis.push(`RSI (4H): ${tf4h.rsi.toFixed(1)} — ${tf4h.rsi > 60 ? 'bullish momentum' : tf4h.rsi < 40 ? 'bearish pressure' : 'neutral zone'}`);
    if (tf4h.stochRSI.signal !== 'neutral') analysis.push(`StochRSI ${tf4h.stochRSI.signal} — K: ${tf4h.stochRSI.k.toFixed(0)}`);

    // Divergence
    if (tf4h.divergence === 'bullish') analysis.push('Bullish RSI divergence — potential reversal signal');
    if (tf4h.divergence === 'bearish') analysis.push('Bearish RSI divergence — momentum warning');

    // Bollinger
    if (tf4h.bbPct < 0.3) analysis.push('Price near lower Bollinger Band — potential reversal zone');
    else if (tf4h.bbPct > 0.7) analysis.push('Price near upper Bollinger Band — potential rejection zone');

    // VWAP
    if (tf4h.vwapAbove) analysis.push('Price above VWAP — bullish intraday bias');
    else analysis.push('Price below VWAP — bearish intraday bias');

    // Volume spike
    if (tf4h.volumeSpike.isSpike) analysis.push(`Volume spike: ${tf4h.volumeSpike.ratio.toFixed(1)}x average — institutional activity`);

    // Order blocks
    if (tf4h.orderBlocks.bullish && Math.abs(tf4h.price - tf4h.orderBlocks.bullish.price) / tf4h.price < 0.01)
      analysis.push(`Bullish order block nearby at $${tf4h.orderBlocks.bullish.price.toFixed(4)}`);
    if (tf4h.orderBlocks.bearish && Math.abs(tf4h.price - tf4h.orderBlocks.bearish.price) / tf4h.price < 0.01)
      analysis.push(`Bearish order block nearby at $${tf4h.orderBlocks.bearish.price.toFixed(4)}`);

    // Fibonacci
    const fib618 = tf4h.fib.levels.find(l => l.ratio === 0.618);
    if (fib618 && Math.abs(tf4h.price - fib618.price) / tf4h.price < 0.005)
      analysis.push(`Price at 0.618 Fibonacci retracement — golden ratio confluence`);

    // Market regime
    analysis.push(`Market regime: ${tf4h.regime.regime} — ${tf4h.regime.regime === 'trending' ? 'trend-following optimal' : tf4h.regime.regime === 'volatile' ? 'reduce position size' : 'range-trading preferred'}`);

    // SMC
    analysis.push(`Support: $${tf4h.sr.support.toFixed(2)} | Resistance: $${tf4h.sr.resistance.toFixed(2)}`);

    // Relative strength
    if (rsVsBTC > 55) analysis.push(`Relative strength vs BTC: ${rsVsBTC}/100 — outperforming BTC`);
    else if (rsVsBTC < 45) analysis.push(`Relative strength vs BTC: ${rsVsBTC}/100 — underperforming BTC`);
    else analysis.push(`Relative strength vs BTC: ${rsVsBTC}/100 — correlated with BTC`);

    // Multi-timeframe confirmation
    const aligned = [tf15, tf1h, tf4h, tf1d, tf1w].filter((t): t is NonNullable<typeof t> => t !== null);
    const bullAligned = aligned.filter((t) => t.emaBull).length;
    const bearAligned = aligned.filter((t) => !t.emaBull).length;
    if (isLong && bullAligned >= 3) analysis.push(`Multi-timeframe confirmation: ${bullAligned}/${aligned.length} timeframes bullish`);
    else if (!isLong && bearAligned >= 3) analysis.push(`Multi-timeframe confirmation: ${bearAligned}/${aligned.length} timeframes bearish`);

    analysis.push(`ATR volatility: ${(tf4h.atrRatio * 100).toFixed(2)}% — ${tf4h.atrRatio > 0.03 ? 'elevated' : 'normal'}`);

    if (coin.volume24h > 500_000_000) analysis.push('Whale activity detected — elevated exchange volume');
    else if (coin.volume24h > 100_000_000) analysis.push('Moderate whale activity — normal volume');

    const multiTimeframe = [
      { timeframe: '15M' as Timeframe, bias: tf15?.bos ?? 'neutral', rsi: tf15?.rsi ?? 50 },
      { timeframe: '1H' as Timeframe, bias: tf1h?.bos ?? 'neutral', rsi: tf1h?.rsi ?? 50 },
      { timeframe: '4H' as Timeframe, bias: tf4h.bos, rsi: tf4h.rsi },
      { timeframe: '1D' as Timeframe, bias: tf1d?.bos ?? 'neutral', rsi: tf1d?.rsi ?? 50 },
      { timeframe: '1W' as Timeframe, bias: tf1w?.bos ?? 'neutral', rsi: tf1w?.rsi ?? 50 },
    ];

    return {
      symbol: coin.symbol,
      name: coin.name,
      price,
      confidence,
      direction,
      bestStrategy,
      scalpingScore,
      dayScore,
      swingScore,
      entry,
      exit: tp3,
      tp1,
      tp2,
      tp3,
      stopLoss,
      trailingStop,
      riskReward: rr,
      holdingTime,
      leverage,
      analysis,
      multiTimeframe,
      relativeStrengthVsBTC: rsVsBTC,
      scannedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function runScanner(coins: Coin[]): Promise<ScannerResult[]> {
  let btcCloses: number[] | null = null;
  try {
    const btcCandles = await fetchKlines('BTCUSDT', '4H');
    btcCloses = btcCandles.map((c) => c.close);
  } catch {
    // proceed without BTC reference
  }

  const results = await Promise.allSettled(coins.map((coin) => scanOneCoin(coin, btcCloses)));

  const valid: ScannerResult[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) {
      valid.push(r.value);
    }
  }

  return valid.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}
