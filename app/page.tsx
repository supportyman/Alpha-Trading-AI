'use client';

import { useState, lazy, Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { TradeOpportunityAlert } from '@/components/trade-opportunity-alert';
import { ErrorBoundary } from '@/components/error-boundary';
import { ScannerView } from '@/components/views/scanner-view';
import { DashboardView } from '@/components/views/dashboard-view';
import { SignalsView } from '@/components/views/signals-view';
import { TechnicalView } from '@/components/views/technical-view';
import { FundamentalView } from '@/components/views/fundamental-view';
import { SentimentView } from '@/components/views/sentiment-view';
import { ChartAiView } from '@/components/views/chart-ai-view';
import { FootprintView } from '@/components/views/footprint-view';
import { RiskView } from '@/components/views/risk-view';
import { PortfolioView } from '@/components/views/portfolio-view';
import { PerformanceView } from '@/components/views/performance-view';
import { NotificationsView } from '@/components/views/notifications-view';
import { AssistantView } from '@/components/views/assistant-view';
import { AdminView } from '@/components/views/admin-view';
import type { TradeSignal, ViewKey } from '@/lib/types';

const views: Record<ViewKey, React.ComponentType<any>> = {
  dashboard: DashboardView,
  scanner: ScannerView,
  signals: SignalsView,
  technical: TechnicalView,
  fundamental: FundamentalView,
  sentiment: SentimentView,
  'chart-ai': ChartAiView,
  footprint: FootprintView,
  risk: RiskView,
  portfolio: PortfolioView,
  performance: PerformanceView,
  notifications: NotificationsView,
  assistant: AssistantView,
  admin: AdminView,
};

export default function Home() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [pendingSignal, setPendingSignal] = useState<TradeSignal | null>(null);

  const handleNavigate = (v: ViewKey) => {
    setView(v);
    if (v !== 'signals') setPendingSignal(null);
  };

  const ActiveView = views[view];

  return (
    <AppShell activeView={view} onNavigate={handleNavigate}>
      <div className="mb-4">
        <TradeOpportunityAlert onNavigate={handleNavigate} onSelectSignal={setPendingSignal} />
      </div>
      <ErrorBoundary key={view}>
        <ActiveView
          onNavigate={handleNavigate}
          selectedSignal={view === 'signals' ? pendingSignal : undefined}
        />
      </ErrorBoundary>
    </AppShell>
  );
}
