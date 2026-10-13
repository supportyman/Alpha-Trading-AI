import type {
  Coin,
  TradeSignal,
  NewsItem,
  SentimentData,
  Candle,
  Timeframe,
} from './types';

const SEED_PRICES: Record<string, number> = {
  'BTC/USDT': 118450,
  'ETH/USDT': 6420,
  'SOL/USDT': 245.8,
  'XRP/USDT': 2.34,
  'BNB/USDT': 712.4,
  'ADA/USDT': 1.12,
  'AVAX/USDT': 48.7,
  'LINK/USDT': 27.3,
  'DOGE/USDT': 0.412,
  'DOT/USDT': 9.85,
  'MATIC/USDT': 0.58,
  'ARB/USDT': 1.24,
  'OP/USDT': 2.67,
  'INJ/USDT': 31.5,
  'SUI/USDT': 4.12,
  'COW/USDT': 0.452,
  'BANK/USDT': 0.0185,
  'ACE/USDT': 2.85,
  'HEI/USDT': 0.128,
};

const TOP_GAINER_CHANGES: Record<string, number> = {
  'COW/USDT': 14.2,
  'BANK/USDT': 11.8,
  'ACE/USDT': 9.5,
  'HEI/USDT': 8.3,
};

const COIN_NAMES: Record<string, string> = {
  'BTC/USDT': 'Bitcoin',
  'ETH/USDT': 'Ethereum',
  'SOL/USDT': 'Solana',
  'XRP/USDT': 'XRP',
  'BNB/USDT': 'BNB',
  'ADA/USDT': 'Cardano',
  'AVAX/USDT': 'Avalanche',
  'LINK/USDT': 'Chainlink',
  'DOGE/USDT': 'Dogecoin',
  'DOT/USDT': 'Polkadot',
  'MATIC/USDT': 'Polygon',
  'ARB/USDT': 'Arbitrum',
  'OP/USDT': 'Optimism',
  'INJ/USDT': 'Injective',
  'SUI/USDT': 'Sui',
  'COW/USDT': 'CoW Protocol',
  'BANK/USDT': 'Banker DAO',
  'ACE/USDT': 'Fusionist',
  'HEI/USDT': 'Heima',
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function genSparkline(base: number, seed: number, points = 24): number[] {
  const arr: number[] = [];
  let val = base * (0.97 + seededRandom(seed) * 0.03);
  for (let i = 0; i < points; i++) {
    val *= 1 + (seededRandom(seed + i * 7) - 0.5) * 0.012;
    arr.push(val);
  }
  return arr;
}

export const INITIAL_COINS: Coin[] = Object.entries(SEED_PRICES).map(
  ([symbol, price], i) => {
    const change = TOP_GAINER_CHANGES[symbol] ?? (seededRandom(i + 1) - 0.45) * 12;
    const sparkline = genSparkline(price, i + 100);
    return {
      symbol,
      name: COIN_NAMES[symbol] || symbol.split('/')[0],
      price,
      change24h: change,
      volume24h: price * (80000000 + seededRandom(i + 20) * 900000000),
      marketCap: price * (50000000 + seededRandom(i + 30) * 900000000),
      high24h: price * (1 + Math.abs(change) / 100 + 0.01),
      low24h: price * (1 - Math.abs(change) / 100 - 0.01),
      sparkline,
    };
  }
);

export function tickCoin(coin: Coin): Coin {
  const drift = (Math.random() - 0.5) * 0.004;
  const newPrice = Math.max(0.0001, coin.price * (1 + drift));
  const sparkline = [...coin.sparkline.slice(1), newPrice];
  const change = coin.change24h + drift * 100 * 8;
  return {
    ...coin,
    price: newPrice,
    change24h: Math.max(-18, Math.min(18, change)),
    high24h: Math.max(coin.high24h, newPrice),
    low24h: Math.min(coin.low24h, newPrice),
    sparkline,
  };
}

export const INITIAL_SIGNALS: TradeSignal[] = [
  {
    id: 'sig-001',
    symbol: 'BTC/USDT',
    direction: 'LONG',
    confidence: 87,
    entry: 118450,
    exit: 121500,
    tp1: 119100,
    tp2: 120200,
    tp3: 121500,
    stopLoss: 117600,
    trailingStop: 'Activate after TP1 — trail by 1.2% (ATR-based)',
    riskReward: '1:3',
    positionSize: '2.5% of portfolio ($5,000 @ $200k acct)',
    holdingTime: '8–24 hours',
    timeframe: '4H',
    createdAt: '2026-07-23T08:12:00Z',
    reasons: [
      'Bullish BOS on 4H — higher high confirmed',
      'Price retested 4H order block with rejection wick',
      'EMA 50/100 golden cross aligned upward',
      'RSI at 58 — room before overbought',
      'FVG below entry acts as demand magnet',
    ],
    status: 'active',
    scalpingConfidence: 71,
    dayConfidence: 83,
    swingConfidence: 87,
  },
  {
    id: 'sig-002',
    symbol: 'SOL/USDT',
    direction: 'LONG',
    confidence: 82,
    entry: 245.8,
    exit: 268,
    tp1: 252,
    tp2: 260,
    tp3: 268,
    stopLoss: 238.5,
    trailingStop: 'Activate after TP1 — trail by 2.5%',
    riskReward: '1:3.1',
    positionSize: '1.8% of portfolio',
    holdingTime: '12–48 hours',
    timeframe: '1D',
    createdAt: '2026-07-23T06:40:00Z',
    reasons: [
      'Daily demand zone holding with 3 rejections',
      'CHOCH confirmed on 4H — bullish structure shift',
      'Volume profile POC aligns with entry',
      'Whale accumulation detected on-chain (+12k SOL)',
    ],
    status: 'active',
    scalpingConfidence: 68,
    dayConfidence: 79,
    swingConfidence: 82,
  },
  {
    id: 'sig-003',
    symbol: 'ETH/USDT',
    direction: 'SHORT',
    confidence: 84,
    entry: 6420,
    exit: 6120,
    tp1: 6320,
    tp2: 6220,
    tp3: 6120,
    stopLoss: 6530,
    trailingStop: 'Activate after TP1 — trail by 1.5%',
    riskReward: '1:2.7',
    positionSize: '2% of portfolio',
    holdingTime: '6–18 hours',
    timeframe: '4H',
    createdAt: '2026-07-23T07:05:00Z',
    reasons: [
      'Bearish MSS on 4H — lower low printed',
      'Supply zone overhead rejected price twice',
      'MACD bearish cross forming on 4H',
      'ETH/BTC relative weakness vs BTC strength',
      'Exchange inflow spike (+8.4k ETH) signals distribution',
    ],
    status: 'active',
    scalpingConfidence: 74,
    dayConfidence: 81,
    swingConfidence: 84,
  },
  {
    id: 'sig-004',
    symbol: 'AVAX/USDT',
    direction: 'LONG',
    confidence: 81,
    entry: 48.7,
    exit: 56.5,
    tp1: 51.2,
    tp2: 53.8,
    tp3: 56.5,
    stopLoss: 46.2,
    trailingStop: 'Activate after TP1 — trail by 3%',
    riskReward: '1:3.1',
    positionSize: '1.5% of portfolio',
    holdingTime: '1–3 days',
    timeframe: '1D',
    createdAt: '2026-07-22T22:15:00Z',
    reasons: [
      'Breakout from 3-week consolidation with volume',
      'Retest of breakout level holding as support',
      'EMA 20 crossed above EMA 50 on daily',
      'Bollinger Band squeeze expansion to upside',
    ],
    status: 'tp1-hit',
    scalpingConfidence: 65,
    dayConfidence: 76,
    swingConfidence: 81,
  },
];

export const INITIAL_NEWS: NewsItem[] = [
  {
    id: 'n1',
    title: 'BlackRock IBTC sees $487M net inflow — largest single-day on record',
    source: 'CoinDesk',
    sentiment: 'bullish',
    impact: 'high',
    time: '12m ago',
    category: 'ETF',
    summary:
      'Spot Bitcoin ETF inflows accelerate as institutional demand reaches new highs. Sustained inflows structurally bullish for BTC price discovery.',
  },
  {
    id: 'n2',
    title: 'Fed signals possible rate cut at next FOMC meeting',
    source: 'Bloomberg',
    sentiment: 'bullish',
    impact: 'high',
    time: '34m ago',
    category: 'Macro',
    summary:
      'Dovish Fed commentary reduces risk-free yield expectations, historically supportive of risk assets including crypto.',
  },
  {
    id: 'n3',
    title: 'Whale moves 4,200 BTC to Binance — potential distribution',
    source: 'Whale Alert',
    sentiment: 'bearish',
    impact: 'medium',
    time: '1h ago',
    category: 'On-Chain',
    summary:
      'Large transfer to exchange hot wallet. Monitor for sell pressure; not confirmatory alone but raises short-term risk.',
  },
  {
    id: 'n4',
    title: 'SEC approves spot ETH ETF staking proposals for comment',
    source: 'The Block',
    sentiment: 'bullish',
    impact: 'high',
    time: '2h ago',
    category: 'Regulation',
    summary:
      'Regulatory progress on ETH staking within ETFs. Long-term structural positive for Ethereum utility and demand.',
  },
  {
    id: 'n5',
    title: 'Bitcoin dominance rises to 58.4% — altseason signal fading',
    source: 'TradingView',
    sentiment: 'neutral',
    impact: 'medium',
    time: '3h ago',
    category: 'Market',
    summary:
      'Rising BTC.D suggests capital rotating to BTC over alts. Short-term altcoin setups require selectivity.',
  },
  {
    id: 'n6',
    title: 'Stablecoin USDT supply increases by $1.2B in 24h',
    source: 'Glassnode',
    sentiment: 'bullish',
    impact: 'medium',
    time: '4h ago',
    category: 'On-Chain',
    summary:
      'Growing stablecoin supply is dry powder on exchanges. Historically a leading indicator of buying pressure.',
  },
  {
    id: 'n7',
    title: 'EU MiCA framework enforcement enters phase two',
    source: 'Reuters',
    sentiment: 'neutral',
    impact: 'low',
    time: '6h ago',
    category: 'Regulation',
    summary:
      'Full MiCA compliance now required for EU-licensed exchanges. Improves clarity but adds operational overhead.',
  },
];

export const SENTIMENT: SentimentData = {
  score: 72,
  mood: 'Greed',
  twitter: 68,
  reddit: 74,
  telegram: 71,
  news: 75,
  trending: [
    { topic: 'BTC ETF Flows', mentions: 18420, change: 32 },
    { topic: 'ETH Staking', mentions: 9210, change: 18 },
    { topic: 'Solana DeFi', mentions: 6740, change: -8 },
    { topic: 'Rate Cuts', mentions: 12380, change: 45 },
    { topic: 'RWA Tokenization', mentions: 5320, change: 22 },
  ],
  topCoins: [
    { symbol: 'BTC', sentiment: 82, mentions: 48200 },
    { symbol: 'ETH', sentiment: 71, mentions: 31400 },
    { symbol: 'SOL', sentiment: 76, mentions: 22800 },
    { symbol: 'XRP', sentiment: 54, mentions: 15600 },
    { symbol: 'LINK', sentiment: 63, mentions: 11200 },
  ],
};

export function genCandles(symbol: string, timeframe: Timeframe, count = 60): Candle[] {
  const base = SEED_PRICES[symbol] || 100;
  const volatility =
    timeframe === '1m' ? 0.003 :
    timeframe === '5m' ? 0.006 :
    timeframe === '15m' ? 0.01 :
    timeframe === '1H' ? 0.018 :
    timeframe === '4H' ? 0.03 :
    timeframe === '1D' ? 0.05 : 0.08;
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1) + timeframe.length;
  const candles: Candle[] = [];
  let price = base * (0.92 + seededRandom(seed) * 0.06);
  for (let i = 0; i < count; i++) {
    const open = price;
    const move = (seededRandom(seed + i * 13) - 0.48) * volatility * base;
    const close = Math.max(0.0001, open + move);
    const high = Math.max(open, close) * (1 + seededRandom(seed + i * 17) * volatility * 0.5);
    const low = Math.min(open, close) * (1 - seededRandom(seed + i * 23) * volatility * 0.5);
    const volume = base * (1000 + seededRandom(seed + i * 29) * 5000);
    candles.push({
      time: `${count - i}`,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return candles;
}

export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];

export const EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Coinbase', 'KuCoin'];
