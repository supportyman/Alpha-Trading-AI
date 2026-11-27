'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_COINS, tickCoin } from './market-data';
import type { Coin } from './types';
import { fetchCoinsDirect, fetchCoinsFallback, fetchKlinesDirect } from './binance-direct';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export function useLiveMarket(intervalMs = 5000) {
  const [coins, setCoins] = useState<Coin[]>(INITIAL_COINS);
  const [usingLive, setUsingLive] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      // Direct CoinGecko → Binance fallback. Supabase Edge Function ab 402 deti hai.
      let live: Coin[];
      try {
        live = await fetchCoinsDirect();
      } catch {
        live = await fetchCoinsFallback();
      }
      if (!live || live.length === 0) throw new Error('No coin data');
      setCoins(live);
      setUsingLive(true);
    } catch {
      setUsingLive(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    timer.current = setInterval(() => {
      // Re-fetch live data every interval; if live fails, simulate tick on last known data
      fetchLive().then(() => {
        // if fetch succeeded, usingLive is true; the interval will keep refreshing
      });
    }, intervalMs);

    // Sub-second simulation for smooth price flicker between fetches (only if not live)
    const flickerTimer = setInterval(() => {
      setUsingLive((live) => {
        if (!live) {
          setCoins((prev) => prev.map((c) => tickCoin(c)));
        }
        return live;
      });
    }, 1500);

    return () => {
      if (timer.current) clearInterval(timer.current);
      clearInterval(flickerTimer);
    };
  }, [fetchLive, intervalMs]);

  return coins;
}

export function useLiveKlines(symbol: string, timeframe: string) {
  const [candles, setCandles] = useState<{ time: string; open: number; high: number; low: number; close: number; volume: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingLive, setUsingLive] = useState(false);

  const binanceSymbol = symbol.replace('/', '').replace('USDT', 'USDT');

  const fetchKlines = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await fetchKlinesDirect(binanceSymbol, timeframe);
      if (!rows || rows.length === 0) throw new Error('No candle data');
      setCandles(rows);
      setError(null);
      setUsingLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
      setUsingLive(false);
      // Fallback to generated candles
      const { genCandles } = await import('./market-data');
      setCandles(genCandles(symbol, timeframe as any, 60));
    } finally {
      setLoading(false);
    }
  }, [binanceSymbol, symbol, timeframe]);

  useEffect(() => {
    fetchKlines();
    const timer = setInterval(fetchKlines, 15000);
    return () => clearInterval(timer);
  }, [fetchKlines]);

  return { candles, loading, error, usingLive };
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function formatCompact(n: number): string {
  const v = typeof n === 'number' && isFinite(n) ? n : Number(n);
  if (!isFinite(v)) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function formatPct(n: number): string {
  const v = typeof n === 'number' && isFinite(n) ? n : Number(n);
  if (!isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}
