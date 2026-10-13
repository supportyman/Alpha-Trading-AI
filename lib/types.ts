export type Timeframe = '1m' | '5m' | '15m' | '15M' | '1H' | '4H' | '1D' | '1W';

export type SignalDirection = 'LONG' | 'SHORT';

export interface Coin {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  sparkline: number[];
}

export interface TradeSignal {
  id: string;
  symbol: string;
  direction: SignalDirection;
  confidence: number;
  entry: number;
  exit: number;
  tp1: number;
  tp2: number;
  tp3: number;
  stopLoss: number;
  trailingStop: string;
  riskReward: string;
  positionSize: string;
  holdingTime: string;
  timeframe: Timeframe;
  createdAt: string;
  reasons: string[];
  status: 'active' | 'tp1-hit' | 'closed';
  scalpingConfidence: number;
  dayConfidence: number;
  swingConfidence: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  time: string;
  category: string;
  summary: string;
  url?: string;
}

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: 'high' | 'medium' | 'low';
  time: string;
  date: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  source: string;
  url?: string;
}

export interface SentimentData {
  score: number;
  mood: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  twitter: number;
  reddit: number;
  telegram: number;
  news: number;
  trending: { topic: string; mentions: number; change: number }[];
  topCoins: { symbol: string; sentiment: number; mentions: number }[];
}

export interface IndicatorReading {
  name: string;
  value: string;
  signal: 'bullish' | 'bearish' | 'neutral';
}

export interface SMCReading {
  label: string;
  status: string;
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface JournalEntry {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  confidence: number | null;
  outcome: string;
  pnl: number | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string | null;
  added_at: string;
}

export interface NotificationItem {
  id: string;
  type: 'signal' | 'tp' | 'sl' | 'trend' | 'news' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export type StrategyType = 'scalping' | 'day' | 'swing';

export interface ScannerResult {
  symbol: string;
  name: string;
  price: number;
  confidence: number;
  direction: SignalDirection;
  bestStrategy: StrategyType;
  scalpingScore: number;
  dayScore: number;
  swingScore: number;
  entry: number;
  exit: number;
  tp1: number;
  tp2: number;
  tp3: number;
  stopLoss: number;
  trailingStop: string;
  riskReward: string;
  holdingTime: string;
  leverage: string;
  analysis: string[];
  multiTimeframe: { timeframe: Timeframe; bias: 'bullish' | 'bearish' | 'neutral'; rsi: number }[];
  relativeStrengthVsBTC: number;
  scannedAt: string;
}

export interface ScannerHistory {
  id: string;
  date: string;
  signalsFound: number;
  topConfidence: number;
  avgConfidence: number;
  scalping: number;
  day: number;
  swing: number;
}

export type ViewKey =
  | 'dashboard'
  | 'scanner'
  | 'signals'
  | 'technical'
  | 'fundamental'
  | 'sentiment'
  | 'chart-ai'
  | 'footprint'
  | 'risk'
  | 'portfolio'
  | 'performance'
  | 'notifications'
  | 'assistant'
  | 'admin';
