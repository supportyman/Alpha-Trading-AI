'use client';

import { Gauge, Twitter, MessageCircle, Send, Newspaper, Hash, TrendingUp, TrendingDown, Loader2, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SENTIMENT } from '@/lib/market-data';
import { useLiveSentiment } from '@/lib/use-live-sentiment';
import { cn } from '@/lib/utils';

export function SentimentView() {
  const { sentiment, loading, usingLive, error } = useLiveSentiment();
  const moodColor =
    sentiment.score >= 75 ? 'text-success' : sentiment.score >= 55 ? 'text-primary' : 'text-warning';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Overall sentiment */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                Fear & Greed Index
              </span>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : usingLive ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-success">
                  <Wifi className="h-3 w-3" /> LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground" title={error || undefined}>
                  <WifiOff className="h-3 w-3" /> {error ? `Error: ${error}` : 'Static'}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative h-40 w-56">
              <svg viewBox="0 0 220 120" className="h-full w-full">
                <path d="M 15 105 A 95 95 0 0 1 205 105" fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" strokeLinecap="round" />
                <path
                  d="M 15 105 A 95 95 0 0 1 205 105"
                  fill="none"
                  stroke={sentiment.score >= 75 ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="298"
                  strokeDashoffset={298 - (sentiment.score / 100) * 298}
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                <g transform={`rotate(${(sentiment.score / 100) * 180 - 90} 110 105)`}>
                  <line x1="110" y1="105" x2="110" y2="25" stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="110" cy="105" r="6" fill="hsl(var(--foreground))" />
                </g>
              </svg>
              <div className="absolute inset-x-0 bottom-0 text-center">
                <p className={cn('text-3xl font-bold', moodColor)}>{sentiment.score}</p>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{sentiment.mood}</p>
              </div>
            </div>
            <div className="mt-4 grid w-full grid-cols-5 gap-1 text-center text-[9px]">
              <span className="text-destructive">Ext. Fear</span>
              <span className="text-warning">Fear</span>
              <span className="text-muted-foreground">Neutral</span>
              <span className="text-primary">Greed</span>
              <span className="text-success">Ext. Greed</span>
            </div>
          </CardContent>
        </Card>

        {/* Source breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sentiment by Source</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SentimentBar icon={Twitter} label="X (Twitter)" value={sentiment.twitter} color="text-accent" />
            <SentimentBar icon={Hash} label="Reddit" value={sentiment.reddit} color="text-warning" />
            <SentimentBar icon={Send} label="Telegram" value={sentiment.telegram} color="text-primary" />
            <SentimentBar icon={Newspaper} label="News Outlets" value={sentiment.news} color="text-success" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trending narratives */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-accent" />
              Trending Narratives
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sentiment.trending.map((t, i) => (
              <div
                key={t.topic}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{t.topic}</p>
                    <p className="text-[11px] text-muted-foreground">{t.mentions.toLocaleString()} mentions</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'px-1.5 py-0 text-[10px]',
                    t.change > 0 ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'
                  )}
                >
                  {t.change > 0 ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                  {Math.abs(t.change)}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top discussed coins */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Discussed Coins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sentiment.topCoins.map((c) => (
              <div key={c.symbol} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
                  {c.symbol.slice(0, 3)}
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{c.symbol}</span>
                    <span className="text-xs text-muted-foreground">{c.mentions.toLocaleString()} mentions</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        c.sentiment >= 70 ? 'bg-success' : c.sentiment >= 50 ? 'bg-primary' : 'bg-warning'
                      )}
                      style={{ width: `${c.sentiment}%` }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    'w-10 text-right text-xs font-bold',
                    c.sentiment >= 70 ? 'text-success' : c.sentiment >= 50 ? 'text-primary' : 'text-warning'
                  )}
                >
                  {c.sentiment}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SentimentBar({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-2xl font-bold">{value}</span>
        <span className={cn('text-xs', value >= 60 ? 'text-success' : value >= 40 ? 'text-primary' : 'text-warning')}>
          {value >= 60 ? 'Bullish' : value >= 40 ? 'Neutral' : 'Bearish'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full rounded-full',
            value >= 60 ? 'bg-success' : value >= 40 ? 'bg-primary' : 'bg-warning'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
