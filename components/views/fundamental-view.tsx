'use client';

import { useEffect, useState } from 'react';
import {
  Newspaper, TrendingUp, TrendingDown, Minus, Filter, ExternalLink,
  RefreshCw, Loader2, Radio, CalendarClock, Clock, Building2, AlertCircle, AlertTriangle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLiveNews } from '@/lib/use-live-news';
import { cn } from '@/lib/utils';

const CATEGORIES = ['All', 'Macro', 'ETF', 'On-Chain', 'Regulation', 'Market'];

export function FundamentalView() {
  const [filter, setFilter] = useState('All');
  const { news, events, loading, refreshing, usingLive, error, lastUpdated, refresh } = useLiveNews(120000);

  const filtered =
    filter === 'All' ? news : news.filter((n) => n.category === filter);

  // Real scores derived from live news classification (keyword classifier on RSS headlines)
  const bullCount = news.filter((n) => n.sentiment === 'bullish').length;
  const bearCount = news.filter((n) => n.sentiment === 'bearish').length;
  const bullScore = news.length > 0 ? Math.round((bullCount / news.length) * 100) : 0;
  const bearScore = news.length > 0 ? Math.round((bearCount / news.length) * 100) : 0;

  const upcomingEvents = events.filter((e) => e.actual === null).slice(0, 8);
  const pastEvents = events.filter((e) => e.actual !== null).slice(0, 4);
  const highImpactUpcoming = upcomingEvents.filter((e) => e.impact === 'high');

  // Real expected volatility from the live economic calendar
  const expectedVol = highImpactUpcoming.length >= 3 ? 'High' : highImpactUpcoming.length >= 1 ? 'Moderate' : 'Low';
  const volBarLevel = expectedVol === 'High' ? 5 : expectedVol === 'Moderate' ? 3 : 1;

  // Real countdown to the next high-impact event
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const nextHigh = highImpactUpcoming.find((e) => e.timestamp && e.timestamp > now) ?? null;
  const formatCountdown = (ms: number) => {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
  };

  return (
    <div className="space-y-6">
      {/* Fundamental score */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Bullish Score
            </p>
            <p className="mt-2 text-3xl font-bold text-success">{bullScore}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-success" style={{ width: `${bullScore}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {bullCount} bullish headlines of {news.length} classified live
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Bearish Score
            </p>
            <p className="mt-2 text-3xl font-bold text-destructive">{bearScore}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-destructive" style={{ width: `${bearScore}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {bearCount} bearish headlines of {news.length} classified live
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Expected Volatility
            </p>
            <p className="mt-2 text-3xl font-bold text-warning">{expectedVol}</p>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2 flex-1 rounded-full',
                    i <= volBarLevel ? 'bg-warning' : 'bg-secondary'
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {nextHigh
                ? `Next high-impact: ${nextHigh.title.slice(0, 40)}${nextHigh.title.length > 40 ? '…' : ''} · in ${formatCountdown((nextHigh.timestamp ?? 0) - now)}`
                : `${highImpactUpcoming.length} high-impact events this week`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error banner when live data fetch fails */}
      {!usingLive && error && !loading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Live news feed is temporarily unavailable. Showing cached/demo data. Click refresh to retry.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Upcoming Economic Events Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-warning" />
            Economic Calendar — Upcoming High-Impact Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcomingEvents.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-center">
              <AlertCircle className="h-5 w-5 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No upcoming events scheduled.</p>
            </div>
          ) : (
            <>
              {upcomingEvents.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-secondary/30',
                    e.impact === 'high' ? 'border-warning/30' : 'border-border'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      e.impact === 'high' ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{e.title}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-1.5 py-0 text-[10px] font-bold',
                          e.impact === 'high' && 'border-warning/40 text-warning',
                          e.impact === 'medium' && 'text-accent',
                          e.impact === 'low' && 'text-muted-foreground'
                        )}
                      >
                        {e.impact}
                      </Badge>
                      <span className="text-[10px] font-medium text-muted-foreground">{e.currency}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {e.date} · {e.time}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    {e.forecast && (
                      <p className="text-[10px] text-muted-foreground">
                        Forecast: <span className="font-semibold text-foreground">{e.forecast}</span>
                      </p>
                    )}
                    {e.previous && (
                      <p className="text-[10px] text-muted-foreground">
                        Previous: <span className="font-semibold text-foreground">{e.previous}</span>
                      </p>
                    )}
                  </div>
                  {e.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 text-xs"
                      onClick={() => window.open(e.url, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}

              {/* Recently released events */}
              {pastEvents.length > 0 && (
                <>
                  <div className="pt-2">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recently Released
                    </p>
                    {pastEvents.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 p-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{e.title}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'px-1.5 py-0 text-[10px] font-bold',
                                e.impact === 'high' && 'border-warning/40 text-warning',
                                e.impact === 'medium' && 'text-accent',
                                e.impact === 'low' && 'text-muted-foreground'
                              )}
                            >
                              {e.impact}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{e.date} · {e.time}</p>
                        </div>
                        <div className="hidden text-right sm:block">
                          <p className="text-[10px] text-muted-foreground">
                            Actual: <span className="font-bold text-success">{e.actual}</span>
                          </p>
                          {e.forecast && (
                            <p className="text-[10px] text-muted-foreground">
                              Forecast: {e.forecast}
                            </p>
                          )}
                          {e.previous && (
                            <p className="text-[10px] text-muted-foreground">
                              Previous: {e.previous}
                            </p>
                          )}
                        </div>
                        {e.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 gap-1.5 text-xs"
                            onClick={() => window.open(e.url, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Filters + live status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={filter === c ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFilter(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {usingLive ? (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
              {lastUpdated && (
                <span className="text-muted-foreground">
                  · updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radio className="h-3 w-3" />
              {error ? 'Live feed unavailable' : 'Connecting...'}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* News feed */}
      {loading && news.length === 0 ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex gap-3 p-4">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
                  <div className="h-3 w-full animate-pulse rounded bg-secondary" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-secondary" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Newspaper className="mb-3 h-10 w-10 text-muted-foreground opacity-40" />
                <p className="text-sm font-semibold">No news in this category</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a different filter or refresh the feed.
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((n) => (
              <Card key={n.id} className="transition-all hover:border-primary/30">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      n.sentiment === 'bullish' && 'bg-success/15 text-success',
                      n.sentiment === 'bearish' && 'bg-destructive/15 text-destructive',
                      n.sentiment === 'neutral' && 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {n.sentiment === 'bullish' ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : n.sentiment === 'bearish' ? (
                      <TrendingDown className="h-5 w-5" />
                    ) : (
                      <Minus className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-1.5 py-0 text-[10px] capitalize',
                          n.sentiment === 'bullish' && 'border-success/40 text-success',
                          n.sentiment === 'bearish' && 'border-destructive/40 text-destructive',
                          n.sentiment === 'neutral' && 'text-muted-foreground'
                        )}
                      >
                        {n.sentiment}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-1.5 py-0 text-[10px] capitalize',
                          n.impact === 'high' && 'border-warning/40 text-warning',
                          n.impact === 'medium' && 'text-accent',
                          n.impact === 'low' && 'text-muted-foreground'
                        )}
                      >
                        {n.impact} impact
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {n.source} · {n.category} · {n.time}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug">{n.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.summary}</p>
                  </div>
                  {n.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 text-xs"
                      onClick={() => window.open(n.url, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Source
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
