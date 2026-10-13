'use client';

import { useEffect, useState, useCallback } from 'react';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export interface TrendingCoin {
  id: string | null;
  symbol: string;
  name: string;
  rank: number | null;
  price: number | null;
  change24h: number | null;
  volume: number | null;
}

export function useLiveTrending(intervalMs = 300000) {
  const [coins, setCoins] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingLive, setUsingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = useCallback(async () => {
    try {
      const resp = await fetch(`${EDGE_FUNCTION_URL}?action=trending`, {
        headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (json?.error) throw new Error(String(json.error));
      if (Array.isArray(json?.coins)) {
        setCoins(json.coins as TrendingCoin[]);
        setUsingLive(true);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
      setUsingLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
    const timer = setInterval(fetchTrending, intervalMs);
    return () => clearInterval(timer);
  }, [fetchTrending, intervalMs]);

  return { coins, loading, usingLive, error, refresh: fetchTrending };
}
