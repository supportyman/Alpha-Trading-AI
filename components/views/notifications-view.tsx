'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell, Zap, Target, ShieldAlert, TrendingUp, TrendingDown, Newspaper,
  Settings, Check, CalendarClock, Loader2, WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useLiveMarket, formatPct } from '@/lib/use-live-market';
import { useLiveNews } from '@/lib/use-live-news';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface DerivedNotification {
  id: string;
  type: 'signal' | 'tp' | 'sl' | 'trend' | 'news' | 'system';
  title: string;
  message: string;
  time: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  signal: Zap,
  tp: Target,
  sl: ShieldAlert,
  trend: TrendingUp,
  news: Newspaper,
  system: Settings,
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-accent/15 text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-destructive/15 text-destructive',
};

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsView() {
  const coins = useLiveMarket(15000);
  const { news, events, loading: newsLoading, usingLive: newsLive, error: newsError } = useLiveNews(120000);
  const [closedTrades, setClosedTrades] = useState<{ id: string; symbol: string; outcome: string; pnl: number | null; closed_at: string | null }[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState({ web: true, email: false, telegram: false, push: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('journal_entries')
        .select('id, symbol, outcome, pnl, closed_at')
        .in('outcome', ['win', 'loss'])
        .order('closed_at', { ascending: false })
        .limit(10);
      if (!cancelled && data) setClosedTrades(data);
    })();
    return () => { cancelled = true; };
  }, []);

  const derived: DerivedNotification[] = useMemo(() => {
    const list: DerivedNotification[] = [];

    // Big movers from live tickers
    for (const c of coins) {
      if (Math.abs(c.change24h) >= 5) {
        list.push({
          id: `mover-${c.symbol}`,
          type: 'trend',
          title: `Big Move: ${c.symbol.toUpperCase()}`,
          message: `${c.change24h >= 0 ? 'Up' : 'Down'} ${formatPct(Math.abs(c.change24h))} in 24h — volatility spike`,
          time: 'live',
          severity: c.change24h >= 0 ? 'success' : 'error',
        });
      }
    }

    // High-impact upcoming economic events
    const upcoming = events
      .filter((e) => e.impact === 'high' && e.actual === null && (!e.timestamp || e.timestamp > Date.now()))
      .slice(0, 4);
    for (const e of upcoming) {
      list.push({
        id: `event-${e.id}`,
        type: 'news',
        title: `High-Impact Event: ${e.title}`,
        message: `${e.currency} · ${e.date} ${e.time}${e.forecast ? ` · forecast ${e.forecast}` : ''}`,
        time: e.timestamp ? `in ${Math.max(1, Math.round((e.timestamp - Date.now()) / 3600000))}h` : e.date,
        severity: 'warning',
      });
    }

    // High-impact news from last 24h
    for (const n of news.filter((x) => x.impact === 'high').slice(0, 4)) {
      list.push({
        id: `news-${n.id}`,
        type: 'news',
        title: n.title,
        message: `${n.source} · ${n.category}`,
        time: n.time,
        severity: n.sentiment === 'bearish' ? 'error' : n.sentiment === 'bullish' ? 'success' : 'info',
      });
    }

    // Closed journal trades
    for (const t of closedTrades) {
      list.push({
        id: `trade-${t.id}`,
        type: t.outcome === 'win' ? 'tp' : 'sl',
        title: `${t.outcome === 'win' ? 'Win' : 'Loss'}: ${t.symbol.toUpperCase()}`,
        message: t.pnl !== null ? `Realized P&L $${Math.round(t.pnl).toLocaleString()}` : 'Trade closed',
        time: t.closed_at ? timeAgoShort(t.closed_at) : 'recently',
        severity: t.outcome === 'win' ? 'success' : 'error',
      });
    }

    return list;
  }, [coins, news, events, closedTrades]);

  const items = derived;
  const unread = items.filter((n) => !readIds.has(n.id)).length;
  const markAllRead = () => setReadIds(new Set(items.map((n) => n.id)));

  if (newsLoading && items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading live notifications…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Notifications list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-primary" />
                Notification Center
                {unread > 0 && (
                  <Badge variant="secondary" className="bg-primary/15 px-1.5 py-0 text-[10px] text-primary">
                    {unread} new
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>
                <Check className="mr-1 h-3.5 w-3.5" /> Mark all read
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Bell className="mb-3 h-10 w-10 text-muted-foreground opacity-40" />
                  <p className="text-sm font-semibold">No live notifications right now</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Alerts appear here from live market moves, news, events, and closed trades.
                  </p>
                </div>
              ) : (
                items.map((n) => {
                  const Icon = TYPE_ICONS[n.type] || Bell;
                  const isRead = readIds.has(n.id);
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                        isRead ? 'border-border bg-secondary/20' : 'border-primary/30 bg-primary/5'
                      )}
                    >
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', SEVERITY_COLORS[n.severity])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{n.title}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{n.time}</span>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.message}</p>
                      </div>
                      {!isRead && (
                        <button
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                          onClick={() => setReadIds((prev) => new Set(prev).add(n.id))}
                          aria-label="Mark read"
                        />
                      )}
                    </div>
                  );
                })
              )}
              {!newsLive && newsError && (
                <p className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                  <WifiOff className="h-3 w-3" /> News feed unavailable — market & trade alerts still live.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notification channels */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Delivery Channels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ChannelRow label="In-App Alerts" desc="Live — shown on this page" enabled={channels.web} onToggle={(v) => setChannels({ ...channels, web: v })} />
              <ChannelRow label="Email Alerts" desc="Coming soon" enabled={channels.email} onToggle={(v) => setChannels({ ...channels, email: v })} />
              <ChannelRow label="Telegram" desc="Coming soon" enabled={channels.telegram} onToggle={(v) => setChannels({ ...channels, telegram: v })} />
              <ChannelRow label="Mobile Push" desc="Coming soon" enabled={channels.push} onToggle={(v) => setChannels({ ...channels, push: v })} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live Alert Triggers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Big 24h movers (≥5%)', active: true },
                { label: 'High-impact news', active: true },
                { label: 'High-impact calendar events', active: true },
                { label: 'Closed journal trades', active: true },
              ].map((t) => (
                <div key={t.label} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
                  <span className="text-xs">{t.label}</span>
                  <Badge variant="outline" className="border-success/40 px-1.5 py-0 text-[10px] text-success">
                    Live
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChannelRow({
  label,
  desc,
  enabled,
  onToggle,
}: {
  label: string;
  desc: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}
