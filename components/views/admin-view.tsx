'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, Newspaper, Gauge, RefreshCw, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Health = 'checking' | 'operational' | 'down';

interface Check {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CHECKS: Check[] = [
  { key: 'tickers', label: 'Market Data (Binance)', icon: Activity },
  { key: 'news', label: 'News Feed', icon: Newspaper },
  { key: 'sentiment', label: 'Market Sentiment', icon: Gauge },
  { key: 'db', label: 'Database & Auth', icon: Database },
];

type HealthMap = Record<string, { status: Health; ms?: number }>;

export function AdminView() {
  const [health, setHealth] = useState<HealthMap>({});
  const [checking, setChecking] = useState(false);

  const checkAll = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !key) return;

    setChecking(true);
    setHealth(Object.fromEntries(CHECKS.map((c) => [c.key, { status: 'checking' as Health }])));

    await Promise.allSettled(
      CHECKS.map(async (c) => {
        const t0 = performance.now();
        try {
          const target =
            c.key === 'db'
              ? `${url}/auth/v1/health`
              : `${url}/functions/v1/market-data?action=${c.key}`;
          const res = await fetch(target, {
            headers: c.key === 'db' ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(8000),
          });
          const ms = Math.round(performance.now() - t0);
          setHealth((h) => ({ ...h, [c.key]: { status: res.ok ? 'operational' : 'down', ms } }));
        } catch {
          setHealth((h) => ({ ...h, [c.key]: { status: 'down', ms: Math.round(performance.now() - t0) } }));
        }
      })
    );
    setChecking(false);
  }, []);

  useEffect(() => {
    checkAll();
  }, [checkAll]);

  const operational = CHECKS.filter((c) => health[c.key]?.status === 'operational').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Server className="h-5 w-5 text-primary" /> System Status
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Self-hosted instance — live checks against your Supabase backend.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={checkAll} disabled={checking} className="text-xs">
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', checking && 'animate-spin')} />
          {checking ? 'Checking…' : 'Re-check'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHECKS.map((c) => {
          const Icon = c.icon;
          const state = health[c.key];
          const status = state?.status || 'checking';
          return (
            <Card key={c.key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {c.label}
                  </p>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      status === 'operational'
                        ? 'bg-success'
                        : status === 'down'
                          ? 'bg-destructive'
                          : 'animate-pulse bg-warning'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm font-semibold capitalize',
                      status === 'operational'
                        ? 'text-success'
                        : status === 'down'
                          ? 'text-destructive'
                          : 'text-warning'
                    )}
                  >
                    {status}
                  </span>
                  {state?.ms !== undefined && status !== 'checking' && (
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">{state.ms}ms</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deployment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
              <span className="font-medium text-foreground">Frontend</span>
              <Badge variant="outline" className="text-[10px]">
                Next.js 13 · Vercel
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
              <span className="font-medium text-foreground">Backend</span>
              <Badge variant="outline" className="text-[10px]">
                Supabase (self-owned)
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
              <span className="font-medium text-foreground">Services healthy</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  operational === CHECKS.length ? 'border-success/40 text-success' : 'border-warning/40 text-warning'
                )}
              >
                {operational}/{CHECKS.length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">About this instance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              This is a self-hosted AlphaTrade AI deployment. Market data, news, and sentiment are
              served in real time through the Supabase Edge Function <code className="text-foreground">market-data</code>.
            </p>
            <p>
              User accounts, subscription billing, and exchange API-key management are not part of
              this deployment — journal and portfolio features use your own Supabase database with
              row-level security.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
