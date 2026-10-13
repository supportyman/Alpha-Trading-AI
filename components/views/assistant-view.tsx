'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot, Send, Sparkles, User, ChevronDown, RefreshCw,
  TrendingUp, TrendingDown, Minus, BarChart2,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLiveMarket, formatPrice } from '@/lib/use-live-market';
import {
  calcRSI, calcMACD, calcEMA, calcATR, calcBollingerBands,
  calcVWAP, detectBOS, findSupportResistance,
} from '@/lib/indicators';
import { generateSignals } from '@/lib/signal-engine';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ─── Timeframes ────────────────────────────────────────────────────────────────
const TIMEFRAMES = [
  { label: '5m',  value: '5',    desc: '5 Minutes' },
  { label: '15m', value: '15',   desc: '15 Minutes' },
  { label: '1H',  value: '60',   desc: '1 Hour' },
  { label: '4H',  value: '240',  desc: '4 Hours' },
  { label: '1D',  value: '1440', desc: '1 Day' },
  { label: '1W',  value: '10080',desc: '1 Week' },
];

// ─── Monitored coins ───────────────────────────────────────────────────────────
const MONITORED = [
  { symbol: 'BTC/USDT', label: 'BTC' },
  { symbol: 'ETH/USDT', label: 'ETH' },
  { symbol: 'SOL/USDT', label: 'SOL' },
  { symbol: 'BNB/USDT', label: 'BNB' },
  { symbol: 'XRP/USDT', label: 'XRP' },
  { symbol: 'AVAX/USDT', label: 'AVAX' },
  { symbol: 'DOGE/USDT', label: 'DOGE' },
  { symbol: 'ADA/USDT', label: 'ADA' },
  { symbol: 'LINK/USDT', label: 'LINK' },
  { symbol: 'DOT/USDT', label: 'DOT' },
  { symbol: 'MATIC/USDT', label: 'MATIC' },
  { symbol: 'UNI/USDT', label: 'UNI' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  symbol?: string;
  timeframe?: string;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchKlines(symbol: string, timeframe: string): Promise<Candle[]> {
  const resp = await fetch(
    `${EDGE_FUNCTION_URL}?action=klines&symbol=${symbol}&timeframe=${timeframe}`,
    { headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' } }
  );
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.candles || [];
}

function tfLabel(value: string): string {
  return TIMEFRAMES.find((t) => t.value === value)?.label ?? value;
}

async function analyzeSymbol(
  binanceSymbol: string,
  displaySymbol: string,
  timeframe: string,
  livePrice: number,
  coins: ReturnType<typeof useLiveMarket>
): Promise<string> {
  const candles = await fetchKlines(binanceSymbol, timeframe);
  if (candles.length < 30) return `Not enough data for ${displaySymbol} on the ${tfLabel(timeframe)} timeframe yet.`;

  const closes = candles.map((c) => c.close);
  const highs  = candles.map((c) => c.high);
  const lows   = candles.map((c) => c.low);

  // Use live price if available
  const price = livePrice || closes[closes.length - 1];
  const rsi    = calcRSI(closes, 14);
  const macd   = calcMACD(closes);
  const atr    = calcATR(highs, lows, closes, 14);
  const bb     = calcBollingerBands(closes, 20, 2);
  const vwap   = calcVWAP(candles.slice(-20));
  const bos    = detectBOS(closes);
  const ema9   = calcEMA(closes, 9);
  const ema50  = calcEMA(closes, 50);
  const emaBull = ema9[ema9.length - 1] > ema50[ema50.length - 1];
  const sr      = findSupportResistance(candles);

  // SMC: Order Block
  const recent = candles.slice(-15);
  let obIdx = -1;
  for (let i = recent.length - 2; i >= 0; i--) {
    const move = Math.abs(recent[i + 1].close - recent[i + 1].open) / recent[i + 1].open;
    if (move > 0.008) { obIdx = i; break; }
  }
  const obBull = obIdx >= 0 && recent[obIdx].close < recent[obIdx].open;

  // FVG
  let fvgText = 'No FVG detected';
  for (let i = recent.length - 3; i >= 0; i--) {
    if (recent[i + 2].low > recent[i].high) {
      fvgText = `Bullish FVG $${formatPrice(recent[i].high)}–$${formatPrice(recent[i + 2].low)}`;
      break;
    }
    if (recent[i + 2].high < recent[i].low) {
      fvgText = `Bearish FVG $${formatPrice(recent[i + 2].high)}–$${formatPrice(recent[i].low)}`;
      break;
    }
  }

  const coin = coins.find((c) => c.symbol === displaySymbol);
  const change = coin ? ` (${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}% 24h)` : '';

  const bias =
    macd.signal === 'bullish' && (emaBull || bos === 'bullish') ? 'BULLISH' :
    macd.signal === 'bearish' && (!emaBull || bos === 'bearish') ? 'BEARISH' : 'NEUTRAL';

  return `**${displaySymbol}** · ${tfLabel(timeframe)} · $${formatPrice(price)}${change}

**Structure**
• BOS: ${bos === 'bullish' ? 'Bullish — higher high confirmed' : bos === 'bearish' ? 'Bearish — lower low confirmed' : 'Ranging — no clear BOS'}
• Order Block: ${obIdx >= 0 ? `${obBull ? 'Bullish' : 'Bearish'} OB at $${formatPrice(obBull ? recent[obIdx].low : recent[obIdx].high)}` : 'No clear OB in recent candles'}
• Fair Value Gap: ${fvgText}

**Indicators**
• RSI (14): ${rsi.toFixed(1)} — ${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : rsi > 55 ? 'bullish momentum' : rsi < 45 ? 'bearish momentum' : 'neutral'}
• MACD: ${macd.value} (${macd.signal})
• EMA 9/50: ${emaBull ? '9 above 50 — uptrend' : '9 below 50 — downtrend'}
• Bollinger: ${bb.pct > 0.75 ? 'Near upper band — extended' : bb.pct < 0.25 ? 'Near lower band — compressed' : 'Mid-range'}
• VWAP: $${formatPrice(vwap)} — price is ${price >= vwap ? 'above' : 'below'}
• ATR (14): $${atr.toFixed(2)} (${((atr / price) * 100).toFixed(2)}% volatility)

**Key Levels**
• Support: $${formatPrice(sr.support)}
• Resistance: $${formatPrice(sr.resistance)}

**Bias: ${bias}** — ${bias === 'BULLISH' ? `look for long entries near $${formatPrice(sr.support)}` : bias === 'BEARISH' ? `look for short entries near $${formatPrice(sr.resistance)}` : 'wait for a clear directional break before entering'}.`;
}

async function getResponse(
  query: string,
  selectedSymbol: string,
  selectedTimeframe: string,
  coins: ReturnType<typeof useLiveMarket>
): Promise<string> {
  const q = query.toLowerCase();

  // Determine which symbol to use: query mention > selected
  const mentionedCoin = coins.find((c) => {
    const base = c.symbol.split('/')[0].toLowerCase();
    const name = c.name.toLowerCase();
    return q.includes(base) || q.includes(name);
  });
  const targetSymbol = mentionedCoin?.symbol ?? selectedSymbol;
  const binanceSymbol = targetSymbol.replace('/', '');
  const livePrice = coins.find((c) => c.symbol === targetSymbol)?.price ?? 0;

  // Determine timeframe from query or use selected
  let tf = selectedTimeframe;
  if (q.includes('5m') || q.includes('5 min')) tf = '5';
  else if (q.includes('15m') || q.includes('15 min')) tf = '15';
  else if (q.includes('1h') || q.includes('1 hour')) tf = '60';
  else if (q.includes('4h') || q.includes('4 hour')) tf = '240';
  else if (q.includes('1d') || q.includes('daily')) tf = '1440';
  else if (q.includes('1w') || q.includes('weekly')) tf = '10080';

  // Best probability setup
  if (q.includes('highest') || q.includes('best') || q.includes('probability') || q.includes('setup')) {
    try {
      const signals = await generateSignals(coins, 70);
      if (signals.length > 0) {
        const s = signals[0];
        return `**Highest-probability setup right now: ${s.symbol} ${s.direction}**

• Timeframe: ${s.timeframe}
• Confidence: ${s.confidence}%
• Entry: ${formatPrice(s.entry)}
• TP1: ${formatPrice(s.tp1)} · TP2: ${formatPrice(s.tp2)} · TP3: ${formatPrice(s.tp3)}
• Stop Loss: ${formatPrice(s.stopLoss)}
• Risk/Reward: ${s.riskReward}

**Why:**
${s.reasons.map((r) => `• ${r}`).join('\n')}`;
      }
    } catch { /* fall through */ }
    return 'No signals above 70% confidence at the moment. Markets may be ranging — try again shortly or broaden the scan.';
  }

  // RSI scan across all pairs
  if ((q.includes('rsi') || q.includes('oversold') || q.includes('overbought')) && !mentionedCoin) {
    const results: string[] = [];
    for (const coin of coins) {
      try {
        const candles = await fetchKlines(coin.symbol.replace('/', ''), tf);
        if (candles.length < 20) continue;
        const rsi = calcRSI(candles.map((c) => c.close), 14);
        if (q.includes('oversold') || q.includes('below 30')) {
          if (rsi < 35) results.push(`• **${coin.symbol}** — RSI ${rsi.toFixed(1)} ${rsi < 30 ? '(oversold)' : '(near oversold)'}`);
        } else if (q.includes('overbought') || q.includes('above 70')) {
          if (rsi > 65) results.push(`• **${coin.symbol}** — RSI ${rsi.toFixed(1)} ${rsi > 70 ? '(overbought)' : '(near overbought)'}`);
        } else {
          results.push(`• **${coin.symbol}** — RSI ${rsi.toFixed(1)}`);
        }
      } catch { continue; }
    }
    if (results.length === 0) return `No pairs match the RSI criteria on the ${tfLabel(tf)} timeframe right now.`;
    return `RSI (14) scan across all pairs on the **${tfLabel(tf)}** timeframe:\n\n${results.join('\n')}\n\nAlways confirm RSI signals with price structure before entering.`;
  }

  // Technical analysis requests — handle locally
  const techKeywords = ['analyze', 'analysis', 'order block', 'fvg', 'fair value gap', 'bos', 'structure',
    'support', 'resistance', 'macd', 'ema', 'bollinger', 'vwap', 'atr', 'candle'];
  const isTechRequest = techKeywords.some((kw) => q.includes(kw)) ||
    (mentionedCoin && q.length < 60 && !q.includes('what') && !q.includes('why') && !q.includes('how') && !q.includes('explain') && !q.includes('tell'));

  if (isTechRequest) {
    return analyzeSymbol(binanceSymbol, targetSymbol, tf, livePrice, coins);
  }

  // Everything else → send to Gemini AI for a general intelligent answer
  try {
    // Gather context for Gemini
    let analysis = '';
    try {
      analysis = await analyzeSymbol(binanceSymbol, targetSymbol, tf, livePrice, coins);
    } catch { /* analysis is optional context */ }

    const context = {
      symbol: targetSymbol,
      timeframe: tf,
      analysis,
      coins: coins.map((c) => ({ symbol: c.symbol, price: c.price, change24h: c.change24h })),
    };

    const resp = await fetch(`${EDGE_FUNCTION_URL}?action=ai-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: query }],
        context,
      }),
    });

    if (!resp.ok) throw new Error(`AI chat HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.reply) return data.reply;
    throw new Error('No reply from AI');
  } catch {
    // Fallback to local analysis if Gemini fails
    return analyzeSymbol(binanceSymbol, targetSymbol, tf, livePrice, coins);
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function AssistantView() {
  const coins = useLiveMarket(5000);

  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [selectedTf, setSelectedTf] = useState('240');
  const [coinOpen, setCoinOpen] = useState(false);
  const coinDropRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content: "I'm your AI trading assistant powered by Google Gemini. I can analyze live charts, scan for signals, and answer any trading or crypto question. Select a coin and timeframe above, then ask me anything.",
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close coin dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (coinDropRef.current && !coinDropRef.current.contains(e.target as Node)) {
        setCoinOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      symbol: selectedSymbol,
      timeframe: selectedTf,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    try {
      const response = await getResponse(text, selectedSymbol, selectedTf, coins);
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response,
        symbol: selectedSymbol,
        timeframe: selectedTf,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: 'Error fetching live data. Please check your connection and try again.',
      }]);
    } finally {
      setTyping(false);
    }
  }, [typing, selectedSymbol, selectedTf, coins]);

  // Auto-analyze when coin or timeframe changes (after initial load)
  const autoRef = useRef(false);
  useEffect(() => {
    if (!autoRef.current) { autoRef.current = true; return; }
    send(`Analyze ${selectedSymbol} on the ${tfLabel(selectedTf)} timeframe`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, selectedTf]);

  const liveCoin = coins.find((c) => c.symbol === selectedSymbol);
  const base = selectedSymbol.split('/')[0];

  const suggestions = [
    `Analyze ${base} on the ${tfLabel(selectedTf)} timeframe`,
    `Show Order Blocks on ${base}`,
    `Find coins with RSI below 30`,
    `Show the highest probability setup today`,
    `Explain risk management for crypto futures`,
    `What is liquidity hunting in trading?`,
  ];

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-5xl flex-col gap-4">
      {/* ── Selector bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Coin dropdown */}
        <div className="relative" ref={coinDropRef}>
          <button
            onClick={() => setCoinOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:border-primary/40"
          >
            <BarChart2 className="h-4 w-4 text-primary" />
            <span className="font-bold">{base}</span>
            <span className="text-xs text-muted-foreground">/USDT</span>
            {liveCoin && (
              <span className={cn(
                'ml-1 text-xs font-mono',
                liveCoin.change24h >= 0 ? 'text-success' : 'text-destructive'
              )}>
                ${formatPrice(liveCoin.price)}
              </span>
            )}
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', coinOpen && 'rotate-180')} />
          </button>
          {coinOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card p-2 shadow-xl">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Select Coin</p>
              <div className="grid grid-cols-3 gap-1">
                {MONITORED.map((c) => {
                  const lc = coins.find((x) => x.symbol === c.symbol);
                  return (
                    <button
                      key={c.symbol}
                      onClick={() => { setSelectedSymbol(c.symbol); setCoinOpen(false); }}
                      className={cn(
                        'rounded-lg px-2 py-2 text-left transition-colors',
                        selectedSymbol === c.symbol
                          ? 'bg-primary/15 text-primary font-semibold'
                          : 'hover:bg-secondary/60 text-foreground'
                      )}
                    >
                      <p className="text-xs font-bold">{c.label}</p>
                      {lc && (
                        <p className={cn('text-[10px]', lc.change24h >= 0 ? 'text-success' : 'text-destructive')}>
                          {lc.change24h >= 0 ? '+' : ''}{lc.change24h.toFixed(1)}%
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Timeframe pills */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1 shadow-sm">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setSelectedTf(tf.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                selectedTf === tf.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Live badge + 24h change */}
        <div className="ml-auto flex items-center gap-3">
          {liveCoin && (
            <div className="flex items-center gap-1.5">
              {liveCoin.change24h >= 0
                ? <TrendingUp className="h-3.5 w-3.5 text-success" />
                : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
              <span className={cn('text-xs font-medium', liveCoin.change24h >= 0 ? 'text-success' : 'text-destructive')}>
                {liveCoin.change24h >= 0 ? '+' : ''}{liveCoin.change24h.toFixed(2)}% 24h
              </span>
            </div>
          )}
          <Badge variant="outline" className="gap-1 border-success/40 text-success text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Re-analyze"
            onClick={() => send(`Analyze ${selectedSymbol} on the ${tfLabel(selectedTf)} timeframe`)}
            disabled={typing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', typing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* ── Chat card ─────────────────────────────────────────── */}
      <Card className="flex flex-1 flex-col overflow-hidden min-h-0">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-border py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">AI Trading Assistant</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {selectedSymbol} · {tfLabel(selectedTf)} · live candles
            </p>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {messages.map((m) => (
            <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                m.role === 'assistant' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
              )}>
                {m.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={cn(
                'max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed',
                m.role === 'assistant' ? 'bg-secondary/50 text-foreground' : 'bg-primary/15 text-foreground'
              )}>
                <FormattedMessage content={m.content} />
                {m.symbol && m.role === 'user' && (
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {m.symbol} · {tfLabel(m.timeframe ?? selectedTf)}
                  </span>
                )}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-secondary/50 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}
        </CardContent>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
              >
                <Sparkles className="h-3 w-3 text-primary" />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${base} on the ${tfLabel(selectedTf)} timeframe…`}
              disabled={typing}
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={typing || !input.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

// Render **bold** and bullet lines nicely
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (line.trim() === '') return <div key={i} className="h-2" />;
        // Render **text** as bold
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-sm leading-relaxed">
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j}>{p.slice(2, -2)}</strong>
                : p
            )}
          </p>
        );
      })}
    </div>
  );
}
