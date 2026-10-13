'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Crosshair,
  Radar,
  LineChart,
  Newspaper,
  Gauge,
  ScanLine,
  Grid3x3,
  ShieldCheck,
  Wallet,
  BarChart3,
  Bell,
  Bot,
  Settings,
  TrendingUp,
  Search,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ViewKey } from '@/lib/types';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { key: 'scanner', label: 'Smart Coin Scanner', icon: Crosshair, group: 'Overview' },
  { key: 'signals', label: 'AI Trade Signals', icon: Radar, group: 'Analysis' },
  { key: 'technical', label: 'Technical Analysis', icon: LineChart, group: 'Analysis' },
  { key: 'fundamental', label: 'Fundamental Feed', icon: Newspaper, group: 'Analysis' },
  { key: 'sentiment', label: 'Sentiment', icon: Gauge, group: 'Analysis' },
  { key: 'chart-ai', label: 'AI Chart Analysis', icon: ScanLine, group: 'Analysis' },
  { key: 'footprint', label: 'Footprint', icon: Grid3x3, group: 'Analysis' },
  { key: 'risk', label: 'Risk Management', icon: ShieldCheck, group: 'Trading' },
  { key: 'portfolio', label: 'Portfolio', icon: Wallet, group: 'Trading' },
  { key: 'performance', label: 'Performance', icon: BarChart3, group: 'Trading' },
  { key: 'notifications', label: 'Notifications', icon: Bell, group: 'System' },
  { key: 'assistant', label: 'AI Assistant', icon: Bot, group: 'System' },
  { key: 'admin', label: 'System Status', icon: Settings, group: 'System' },
];

interface AppShellProps {
  activeView: ViewKey;
  onNavigate: (v: ViewKey) => void;
  children: React.ReactNode;
}

export function AppShell({ activeView, onNavigate, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = NAV.find((n) => n.key === activeView)!;

  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  const Sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card/50 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight">AlphaTrade AI</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Institutional Intelligence
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group} className="mb-5">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {group}
            </p>
            <div className="space-y-0.5">
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onNavigate(item.key);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary/12 text-primary ring-1 ring-primary/25'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                    {item.label}
                    {item.key === 'signals' && (
                      <Badge
                        variant="secondary"
                        className="ml-auto bg-primary/15 px-1.5 py-0 text-[10px] text-primary"
                      >
                        Live
                      </Badge>
                    )}
                    {item.key === 'scanner' && (
                      <Badge
                        variant="secondary"
                        className="ml-auto bg-accent/15 px-1.5 py-0 text-[10px] text-accent"
                      >
                        AI
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-lg bg-secondary/60 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs font-medium">Engine Online</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Scanning 15 major coins via live exchange feeds.
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{Sidebar}</div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full animate-slide-up">{Sidebar}</div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/40 px-4 backdrop-blur-xl md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <active.icon className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold tracking-tight md:text-lg">
              {active.label}
            </h1>
          </div>

          <div className="relative ml-auto hidden w-64 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search markets, signals…"
              className="h-9 border-border bg-secondary/50 pl-9 text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:ml-3">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => onNavigate('notifications')}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning ring-2 ring-card" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate('assistant')}
              className="text-primary"
            >
              <Bot className="h-5 w-5" />
            </Button>
            <div className="ml-1 hidden h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground sm:flex">
              AT
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-4 md:p-6">{children}</div>
        </main>
      </div>

      {mobileOpen && (
        <button
          className="fixed right-4 top-4 z-[60] rounded-md bg-card p-2 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
