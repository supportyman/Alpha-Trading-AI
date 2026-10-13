'use client';

import { useEffect, useState, useCallback } from 'react';
import type { SentimentData } from './types';
import { SENTIMENT } from './market-data';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export function useLiveSentiment(intervalMs = 60000) {
  const [sentiment, setSentiment] = useState<SentimentData>(SENTIMENT);
  const [loading, setLoading] = useState(true);
  const [usingLive, setUsingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSentiment = useCallback(async () => {
    try {
      const resp = await fetch(`${EDGE_FUNCTION_URL}?action=sentiment`, {
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (typeof data.score !== 'number' || typeof data.mood !== 'string') {
        throw new Error('Invalid sentiment data');
      }
      setSentiment(data as SentimentData);
      setUsingLive(true);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      console.error('[useLiveSentiment] fetch failed:', msg, 'URL:', EDGE_FUNCTION_URL);
      setError(msg);
      setUsingLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSentiment();
    const timer = setInterval(fetchSentiment, intervalMs);
    return () => clearInterval(timer);
  }, [fetchSentiment, intervalMs]);

  return { sentiment, loading, usingLive, error };
}
