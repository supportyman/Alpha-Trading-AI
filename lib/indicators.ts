// Technical indicator calculations from real candle data

export function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      prev = values[0];
      ema.push(values[0]);
    } else {
      prev = values[i] * k + prev * (1 - k);
      ema.push(prev);
    }
  }
  return ema;
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calcMACD(closes: number[]): {
  signal: 'bullish' | 'bearish' | 'neutral';
  value: string;
  histogram: number;
} {
  if (closes.length < 35) return { signal: 'neutral', value: 'Insufficient data', histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }
  const signalLine = calcEMA(macdLine, 9);
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const prevMacd = macdLine[macdLine.length - 2];
  const prevSignal = signalLine[signalLine.length - 2];
  const histogram = lastMacd - lastSignal;

  // Only report a cross signal when the histogram actually flips sign
  if (prevMacd <= prevSignal && lastMacd > lastSignal) {
    return { signal: 'bullish', value: 'Bullish cross', histogram };
  }
  if (prevMacd >= prevSignal && lastMacd < lastSignal) {
    return { signal: 'bearish', value: 'Bearish cross', histogram };
  }
  // Neutral zone: histogram small relative to price (no strong momentum)
  const price = closes[closes.length - 1];
  const histPct = Math.abs(histogram) / price;
  if (histPct < 0.0005) {
    return { signal: 'neutral', value: 'Flat — no momentum', histogram };
  }
  return {
    signal: lastMacd > lastSignal ? 'bullish' : 'bearish',
    value: lastMacd > lastSignal ? 'Above signal' : 'Below signal',
    histogram,
  };
}

export function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number {
  if (closes.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  const recent = trs.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / recent.length;
}

export function calcBollingerBands(
  closes: number[],
  period = 20,
  mult = 2
): { upper: number; middle: number; lower: number; pct: number } {
  if (closes.length < period) {
    const price = closes[closes.length - 1] || 0;
    return { upper: price, middle: price, lower: price, pct: 0.5 };
  }
  const slice = closes.slice(-period);
  const middle = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = middle + mult * std;
  const lower = middle - mult * std;
  const price = closes[closes.length - 1];
  const range = upper - lower;
  const pct = range > 0 ? (price - lower) / range : 0.5;
  return { upper, middle, lower, pct };
}

export function calcVWAP(candles: { high: number; low: number; close: number; volume: number }[]): number {
  let sumPV = 0;
  let sumV = 0;
  for (const c of candles) {
    if (c.volume <= 0) continue;
    const typical = (c.high + c.low + c.close) / 3;
    sumPV += typical * c.volume;
    sumV += c.volume;
  }
  // Fallback: if no volume data available, use SMA of typical prices
  if (sumV <= 0) {
    const typicals = candles.map((c) => (c.high + c.low + c.close) / 3);
    return typicals.length > 0
      ? typicals.reduce((s, v) => s + v, 0) / typicals.length
      : 0;
  }
  return sumPV / sumV;
}

export function detectBOS(closes: number[]): 'bullish' | 'bearish' | 'neutral' {
  if (closes.length < 20) return 'neutral';
  const lookback = closes.slice(-20);
  const last3 = lookback.slice(-3);
  const swingHigh = Math.max(...lookback.slice(0, -3));
  const swingLow = Math.min(...lookback.slice(0, -3));
  if (Math.max(...last3) > swingHigh) return 'bullish';
  if (Math.min(...last3) < swingLow) return 'bearish';
  return 'neutral';
}

export function detectRSIDivergence(closes: number[], rsi: number): 'bullish' | 'bearish' | 'none' {
  if (closes.length < 20) return 'none';
  const half = Math.floor(closes.length / 2);
  const firstHalf = closes.slice(0, half);
  const secondHalf = closes.slice(half);
  const firstLow = Math.min(...firstHalf);
  const secondLow = Math.min(...secondHalf);
  if (secondLow < firstLow && rsi > 40) return 'bullish';
  const firstHigh = Math.max(...firstHalf);
  const secondHigh = Math.max(...secondHalf);
  if (secondHigh > firstHigh && rsi < 60) return 'bearish';
  return 'none';
}

export function findSupportResistance(candles: { high: number; low: number }[]): {
  support: number;
  resistance: number;
} {
  if (candles.length === 0) return { support: 0, resistance: 0 };
  const recent = candles.slice(-20);
  const support = Math.min(...recent.map((c) => c.low));
  const resistance = Math.max(...recent.map((c) => c.high));
  return { support, resistance };
}

export function calcStochRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14): {
  k: number;
  d: number;
  signal: 'bullish' | 'bearish' | 'neutral';
} {
  if (closes.length < rsiPeriod + stochPeriod) return { k: 50, d: 50, signal: 'neutral' };
  const rsiVals: number[] = [];
  for (let i = rsiPeriod; i <= closes.length; i++) {
    rsiVals.push(calcRSI(closes.slice(0, i), rsiPeriod));
  }
  const stochRSI: number[] = [];
  for (let i = stochPeriod; i < rsiVals.length; i++) {
    const slice = rsiVals.slice(i - stochPeriod, i + 1);
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    stochRSI.push(max > min ? (rsiVals[i] - min) / (max - min) * 100 : 50);
  }
  const k = stochRSI[stochRSI.length - 1] ?? 50;
  const d = stochRSI.slice(-3).reduce((s, v) => s + v, 0) / Math.min(3, stochRSI.length);
  let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (k < 20 && k > (stochRSI[stochRSI.length - 2] ?? 0)) signal = 'bullish';
  else if (k > 80 && k < (stochRSI[stochRSI.length - 2] ?? 100)) signal = 'bearish';
  return { k, d, signal };
}

export function calcADX(highs: number[], lows: number[], closes: number[], period = 14): {
  adx: number;
  plusDI: number;
  minusDI: number;
  trend: 'strong-up' | 'strong-down' | 'weak' | 'ranging';
} {
  if (closes.length < period * 2) return { adx: 0, plusDI: 0, minusDI: 0, trend: 'ranging' };
  const trs: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  const smooth = (arr: number[]) => {
    const out: number[] = [];
    let sum = arr.slice(0, period).reduce((s, v) => s + v, 0);
    out.push(sum);
    for (let i = period; i < arr.length; i++) {
      sum = sum - sum / period + arr[i];
      out.push(sum);
    }
    return out;
  };
  const trSmooth = smooth(trs);
  const plusDMSmooth = smooth(plusDM);
  const minusDMSmooth = smooth(minusDM);
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  for (let i = 0; i < Math.min(trSmooth.length, plusDMSmooth.length, minusDMSmooth.length); i++) {
    plusDI.push(trSmooth[i] > 0 ? (plusDMSmooth[i] / trSmooth[i]) * 100 : 0);
    minusDI.push(trSmooth[i] > 0 ? (minusDMSmooth[i] / trSmooth[i]) * 100 : 0);
  }
  const dx: number[] = [];
  for (let i = 0; i < plusDI.length; i++) {
    const sum = plusDI[i] + minusDI[i];
    dx.push(sum > 0 ? Math.abs(plusDI[i] - minusDI[i]) / sum * 100 : 0);
  }
  const adxSlice = dx.slice(-period);
  const adx = adxSlice.reduce((s, v) => s + v, 0) / Math.max(adxSlice.length, 1);
  const lastPlus = plusDI[plusDI.length - 1] ?? 0;
  const lastMinus = minusDI[minusDI.length - 1] ?? 0;
  let trend: 'strong-up' | 'strong-down' | 'weak' | 'ranging' = 'ranging';
  if (adx > 25) {
    if (lastPlus > lastMinus) trend = 'strong-up';
    else trend = 'strong-down';
  } else if (adx > 20) {
    trend = 'weak';
  }
  return { adx, plusDI: lastPlus, minusDI: lastMinus, trend };
}

export function detectVolumeSpike(candles: { volume: number }[], lookback = 20, threshold = 2): {
  isSpike: boolean;
  ratio: number;
  recentAvg: number;
} {
  if (candles.length < lookback + 1) return { isSpike: false, ratio: 1, recentAvg: 0 };
  const recent = candles.slice(-lookback - 1, -1);
  const avg = recent.reduce((s, c) => s + c.volume, 0) / lookback;
  const current = candles[candles.length - 1].volume;
  const ratio = avg > 0 ? current / avg : 1;
  return { isSpike: ratio >= threshold, ratio, recentAvg: avg };
}

export function detectOrderBlock(candles: Candle[]): {
  bullish: { price: number; strength: number } | null;
  bearish: { price: number; strength: number } | null;
} {
  if (candles.length < 10) return { bullish: null, bearish: null };
  const recent = candles.slice(-30);
  let bullish: { price: number; strength: number } | null = null;
  let bearish: { price: number; strength: number } | null = null;
  for (let i = 2; i < recent.length - 2; i++) {
    const c = recent[i];
    const next = recent[i + 1];
    if (c.close < c.open && next.close > next.open && next.close > c.high) {
      const level = (c.open + c.close) / 2;
      const strength = c.volume;
      if (!bullish || strength > bullish.strength) bullish = { price: level, strength };
    }
    if (c.close > c.open && next.close < next.open && next.close < c.low) {
      const level = (c.open + c.close) / 2;
      const strength = c.volume;
      if (!bearish || strength > bearish.strength) bearish = { price: level, strength };
    }
  }
  return { bullish, bearish };
}

export function calcFibonacci(candles: Candle[]): {
  levels: { level: string; price: number; ratio: number }[];
  swingHigh: number;
  swingLow: number;
  direction: 'up' | 'down';
} {
  if (candles.length < 10) return { levels: [], swingHigh: 0, swingLow: 0, direction: 'up' };
  const recent = candles.slice(-50);
  const swingHigh = Math.max(...recent.map(c => c.high));
  const swingLow = Math.min(...recent.map(c => c.low));
  const highIdx = recent.findIndex(c => c.high === swingHigh);
  const lowIdx = recent.findIndex(c => c.low === swingLow);
  const direction = highIdx > lowIdx ? 'up' : 'down';
  const range = swingHigh - swingLow;
  const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const levels = fibRatios.map(r => ({
    level: `${(r * 100).toFixed(1)}%`,
    price: direction === 'up' ? swingLow + range * r : swingHigh - range * r,
    ratio: r,
  }));
  return { levels, swingHigh, swingLow, direction };
}

export function detectMarketRegime(closes: number[]): {
  regime: 'trending' | 'ranging' | 'volatile';
  volatility: number;
  trendStrength: number;
} {
  if (closes.length < 30) return { regime: 'ranging', volatility: 0, trendStrength: 0 };
  const recent = closes.slice(-30);
  const returns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
  }
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(24);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const emaSpread = Math.abs(ema20[ema20.length - 1] - ema50[ema50.length - 1]) / closes[closes.length - 1];
  const trendStrength = emaSpread * 100;
  let regime: 'trending' | 'ranging' | 'volatile' = 'ranging';
  if (volatility > 0.05) regime = 'volatile';
  else if (trendStrength > 2) regime = 'trending';
  return { regime, volatility, trendStrength };
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
