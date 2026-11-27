'use client';

// Direct public market data — Supabase Edge Function par depend nahi.
// Binance aur CoinGecko dono CORS `*` dete hain, to browser se seedha chalte hain.
// Har response 60s cache hoti hai, jisse invocation/request count bahut kam rehta hai.

import type { Coin } from './types';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const CACHE = new Map<string, { t: number; v: unknown }>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T;
  const v = await fn();
  CACHE.set(key, { t: Date.now(), v });
  return v;
}

const BINANCE_INTERVALS: Record<string, string> = {
  '1': '1m', '5': '5m', '15': '15m', '15M': '15m',
  '60': '1h', '1H': '1h', '240': '4h', '4H': '4h',
  '1440': '1d', '1D': '1d', '10080': '1w', '1W': '1w',
};

// Base symbol (BTCUSDT) ya `BTC/USDT` dono accept karein.
function normalizeSymbol(symbol: string): string {
  return String(symbol || '').replace(/\//g, '').toUpperCase().replace(/USDT$/, 'USDT');
}

/** Binance public klines → app ke Candle shape me. */
export async function fetchKlinesDirect(
  symbol: string,
  timeframe: string,
  limit = 200
): Promise<Candle[]> {
  const binanceSymbol = normalizeSymbol(symbol);
  const interval = BINANCE_INTERVALS[String(timeframe)] || '4h';
  const key = `klines:${binanceSymbol}:${interval}:${limit}`;

  return cached(key, 60_000, async () => {
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`Binance klines failed: ${resp.status}`);
    const raw = (await resp.json()) as unknown[][];
    return raw.map((r) => ({
      time: String(r[0]),
      open: parseFloat(r[1] as string),
      high: parseFloat(r[2] as string),
      low: parseFloat(r[3] as string),
      close: parseFloat(r[4] as string),
      volume: parseFloat(r[5] as string),
    }));
  });
}

const COIN_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple', BNB: 'binancecoin',
  ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink', DOGE: 'dogecoin', DOT: 'polkadot',
  MATIC: 'matic-network', ARB: 'arbitrum', OP: 'optimism', INJ: 'injective-protocol', SUI: 'sui',
  COW: 'cow-protocol', BANK: 'banker-dao', ACE: 'fusionist', HEI: 'heima-network',
};

const COIN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', BNB: 'BNB', ADA: 'Cardano',
  AVAX: 'Avalanche', LINK: 'Chainlink', DOGE: 'Dogecoin', DOT: 'Polkadot', MATIC: 'Polygon',
  ARB: 'Arbitrum', OP: 'Optimism', INJ: 'Injective', SUI: 'Sui', COW: 'CoW Protocol',
  BANK: 'Banker DAO', ACE: 'Fusionist', HEI: 'Heima',
};

/** CoinGecko markets → app ke Coin shape me (real price, volume, market cap, sparkline). */
export async function fetchCoinsDirect(): Promise<Coin[]> {
  const ids = Object.values(COIN_IDS).join(',');
  return cached('coins-direct', 30_000, async () => {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`CoinGecko markets failed: ${resp.status}`);
    const rows = (await resp.json()) as any[];
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    const coins: Coin[] = [];
    for (const [base, id] of Object.entries(COIN_IDS)) {
      const r: any = byId.get(id);
      if (!r) continue;
      const price = Number(r.current_price);
      if (!Number.isFinite(price)) continue;
      coins.push({
        symbol: `${base}/USDT`,
        name: COIN_NAMES[base] || String(r.name || base),
        price,
        change24h: Number(r.price_change_percentage_24h ?? 0),
        volume24h: Number(r.total_volume ?? 0),
        marketCap: Number(r.market_cap ?? 0),
        high24h: Number(r.high_24h ?? price),
        low24h: Number(r.low_24h ?? price),
        sparkline: (r.sparkline_in_7d?.price || []).slice(-24).map((n: any) => Number(n)),
      });
    }
    if (!coins.length) throw new Error('CoinGecko se koi coin nahi mila');
    return coins;
  });
}

/** Binance 24hr ticker fallback (agar CoinGecko block ho). */
export async function fetchCoinsFallback(): Promise<Coin[]> {
  return cached('coins-binance-fallback', 30_000, async () => {
    const bases = Object.keys(COIN_IDS);
    const symbolsParam = encodeURIComponent(JSON.stringify(bases.map((b) => `${b}USDT`)));
    const resp = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`, {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) throw new Error(`Binance tickers failed: ${resp.status}`);
    const rows = (await resp.json()) as any[];
    return rows.map((r) => {
      const base = String(r.symbol).replace(/USDT$/, '');
      const price = Number(r.lastPrice);
      return {
        symbol: `${base}/USDT`,
        name: COIN_NAMES[base] || base,
        price,
        change24h: Number(r.priceChangePercent),
        volume24h: Number(r.quoteVolume),
        marketCap: 0,
        high24h: Number(r.highPrice),
        low24h: Number(r.lowPrice),
        sparkline: [],
      };
    });
  });
}

export function clearMarketCache() {
  CACHE.clear();
}
