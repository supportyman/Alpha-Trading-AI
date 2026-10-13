'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NewsItem, EconomicEvent } from './types';
import { INITIAL_NEWS } from './market-data';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export function useLiveNews(intervalMs = 120000) {
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usingLive, setUsingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    setRefreshing(true);
    let newsOk = false;
    let eventsOk = false;

    try {
      const [newsResp, eventsResp] = await Promise.all([
        fetch(`${EDGE_FUNCTION_URL}?action=news`, {
          headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        }),
        fetch(`${EDGE_FUNCTION_URL}?action=economic-calendar`, {
          headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        }),
      ]);

      // Process news independently
      if (newsResp.ok) {
        try {
          const newsData = await newsResp.json();
          if (newsData.news && Array.isArray(newsData.news) && newsData.news.length > 0) {
            setNews(newsData.news as NewsItem[]);
            setUsingLive(true);
            setError(null);
            setLastUpdated(new Date());
            newsOk = true;
          }
        } catch {
          // JSON parse error
        }
      }

      // Process events independently — don't let news failure block events
      if (eventsResp.ok) {
        try {
          const eventsData = await eventsResp.json();
          if (eventsData.events && Array.isArray(eventsData.events)) {
            setEvents(eventsData.events as EconomicEvent[]);
            eventsOk = true;
          }
        } catch {
          // JSON parse error
        }
      }

      if (!newsOk && !eventsOk) {
        throw new Error('Both news and calendar fetch failed');
      }
      if (!newsOk) {
        setError('News feed unavailable — showing cached data');
        setUsingLive(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      console.error('[useLiveNews] fetch failed:', msg);
      setError(msg);
      setUsingLive(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const timer = setInterval(fetchNews, intervalMs);
    return () => clearInterval(timer);
  }, [fetchNews, intervalMs]);

  return { news, events, loading, refreshing, usingLive, error, lastUpdated, refresh: fetchNews };
}
