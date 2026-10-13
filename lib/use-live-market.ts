'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_COINS, tickCoin } from './market-data';
import type { Coin } from './types';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export function useLiveMarket(intervalMs = 5000) {
  const [coins, setCoins] = useState<Coin[]>(INITIAL_COINS);
  const [usingLive, setUsingLive] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      const resp = await fetch(`${EDGE_FUNCTION_URL}?action=tickers`, {
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data.coins || !Array.isArray(data.coins) || data.coins.length === 0) {
        throw new Error('No coin data');
      }
      setCoins(data.coins);
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
      const resp = await fetch(
        `${EDGE_FUNCTION_URL}?action=klines&symbol=${binanceSymbol}&timeframe=${timeframe}`,
        {
          headers: {
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.candles && Array.isArray(data.candles)) {
        setCandles(data.candles);
        setError(null);
        setUsingLive(true);
      } else {
        throw new Error('No candle data');
      }
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
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}
