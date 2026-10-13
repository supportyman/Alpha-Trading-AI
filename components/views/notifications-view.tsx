'use client';

import { useState } from 'react';
import {
  Bell,
  Zap,
  Target,
  ShieldAlert,
  TrendingUp,
  Newspaper,
  Settings,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/lib/types';

const NOTIFICATIONS: NotificationItem[] = [
  { id: '1', type: 'signal', title: 'New AI Signal: BTC/USDT LONG', message: '87% confidence LONG setup detected on 4H timeframe', time: '2m ago', read: false, severity: 'info' },
  { id: '2', type: 'tp', title: 'TP1 Hit: AVAX/USDT', message: 'Take profit 1 reached at $51.20 — trailing stop activated', time: '18m ago', read: false, severity: 'success' },
  { id: '3', type: 'news', title: 'High-Impact News: Fed Rate Decision', message: 'FOMC meeting in 2 days — possible rate cut signaled', time: '34m ago', read: false, severity: 'warning' },
  { id: '4', type: 'trend', title: 'Trend Change: ETH/USDT', message: '4H structure shifted bearish — MSS confirmed', time: '1h ago', read: true, severity: 'warning' },
  { id: '5', type: 'sl', title: 'Stop Loss Hit: DOGE/USDT', message: 'Position closed at $0.398 — loss of $120', time: '2h ago', read: true, severity: 'error' },
  { id: '6', type: 'signal', title: 'New AI Signal: SOL/USDT LONG', message: '82% confidence LONG setup on daily timeframe', time: '3h ago', read: true, severity: 'info' },
  { id: '7', type: 'tp', title: 'TP2 Hit: BTC/USDT', message: 'Take profit 2 reached at $120,200', time: '5h ago', read: true, severity: 'success' },
];

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

export function NotificationsView() {
  const [items, setItems] = useState(NOTIFICATIONS);
  const [channels, setChannels] = useState({
    web: true,
    email: true,
    telegram: false,
    push: true,
  });

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const unread = items.filter((n) => !n.read).length;

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
              {items.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                      n.read ? 'border-border bg-secondary/20' : 'border-primary/30 bg-primary/5'
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
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                );
              })}
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
              <ChannelRow label="Web Notifications" desc="In-app browser alerts" enabled={channels.web} onToggle={(v) => setChannels({ ...channels, web: v })} />
              <ChannelRow label="Email Alerts" desc="alerts@alphatrade.ai" enabled={channels.email} onToggle={(v) => setChannels({ ...channels, email: v })} />
              <ChannelRow label="Telegram" desc="@AlphaTradeAI_Bot" enabled={channels.telegram} onToggle={(v) => setChannels({ ...channels, telegram: v })} />
              <ChannelRow label="Mobile Push" desc="iOS & Android" enabled={channels.push} onToggle={(v) => setChannels({ ...channels, push: v })} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alert Triggers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                'New signal generated',
                'Take profit hit',
                'Stop loss hit',
                'Trend change detected',
                'High-impact news event',
                'Confidence threshold met',
              ].map((t) => (
                <div key={t} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
                  <span className="text-xs">{t}</span>
                  <Switch defaultChecked />
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
