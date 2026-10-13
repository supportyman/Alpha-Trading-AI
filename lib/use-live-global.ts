'use client';

import { useEffect, useState, useCallback } from 'react';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export interface GlobalMarketData {
  marketCap: number | null;
  volume24h: number | null;
  btcDominance: number | null;
  ethDominance: number | null;
  marketCapChange24h: number | null;
  activeCoins: number | null;
  updatedAt: number | null;
  source?: string;
}

export function useLiveGlobal(intervalMs = 60000) {
  const [data, setData] = useState<GlobalMarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingLive, setUsingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGlobal = useCallback(async () => {
    try {
      const resp = await fetch(`${EDGE_FUNCTION_URL}?action=global`, {
        headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (json?.error) throw new Error(String(json.error));
      if (typeof json?.marketCap !== 'number' && typeof json?.btcDominance !== 'number') {
        throw new Error('Invalid global data');
      }
      setData(json as GlobalMarketData);
      setUsingLive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
      setUsingLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobal();
    const timer = setInterval(fetchGlobal, intervalMs);
    return () => clearInterval(timer);
  }, [fetchGlobal, intervalMs]);

  return { data, loading, usingLive, error, refresh: fetchGlobal };
}
