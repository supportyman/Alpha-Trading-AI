'use client';

import { useState, useRef } from 'react';
import {
  ScanLine, Upload, Link2, Sparkles, TrendingUp, TrendingDown,
  Target, Layers, Activity, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLiveMarket, formatPrice } from '@/lib/use-live-market';
import { cn } from '@/lib/utils';

const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/functions/v1/market-data`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AnalysisResult {
  symbol: string;
  price: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  trend: string;
  support: number;
  resistance: number;
  orderBlock: { price: number; type: 'bullish' | 'bearish' };
  fvg: { price: number; type: 'filled' | 'unfilled' };
  rsiDivergence: string;
  entryLow: number;
  entryHigh: number;
  breakoutPotential: string;
  summary: string;
}

interface VisionKeyLevel { price: number; type: 'support' | 'resistance'; strength: string }
interface VisionOB { type: 'bullish' | 'bearish'; zone: string }
interface VisionFVG { type: 'bullish' | 'bearish'; zone: string }
interface VisionResult {
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  key_levels: VisionKeyLevel[];
  order_blocks: VisionOB[];
  fvg: VisionFVG[];
  entry_zones: number[];
  risk_notes: string[];
  error?: string;
}

async function fetchCandles(symbol: string): Promise<Candle[]> {
  // Direct Binance — Edge Function 402 bypass.
  const { fetchKlinesDirect } = await import('@/lib/binance-direct');
  return fetchKlinesDirect(symbol, '240');
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function analyzeCandles(candles: Candle[], symbol: string, livePrice: number): AnalysisResult {
  const closes = candles.map((c) => c.close);
  const highs  = candles.map((c) => c.high);
  const lows   = candles.map((c) => c.low);
  const price  = livePrice || closes[closes.length - 1];

  // Support: lowest low in last 20 candles
  const recentLows  = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const support    = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);

  // RSI
  const rsi = calcRSI(closes, 14);

  // EMA trend
  const ema20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
  const ema50 = closes.slice(-50).reduce((s, v) => s + v, 0) / Math.min(50, closes.length);
  const emaBull = ema20 > ema50 && price > ema20;

  // MACD-like direction
  const ema12arr = closes.slice(-12);
  const ema26arr = closes.slice(-26);
  const ema12 = ema12arr.reduce((s, v) => s + v, 0) / ema12arr.length;
  const ema26 = ema26arr.reduce((s, v) => s + v, 0) / ema26arr.length;
  const macdBull = ema12 > ema26;

  // BOS: new high or new low
  const priorHigh = Math.max(...highs.slice(-10, -1));
  const priorLow  = Math.min(...lows.slice(-10, -1));
  const bosBull   = price > priorHigh;
  const bosBear   = price < priorLow;

  // Determine direction
  const bullScore = (emaBull ? 1 : 0) + (macdBull ? 1 : 0) + (bosBull ? 1 : 0) + (rsi > 50 ? 1 : 0);
  const bearScore = (!emaBull ? 1 : 0) + (!macdBull ? 1 : 0) + (bosBear ? 1 : 0) + (rsi < 50 ? 1 : 0);
  const direction = bullScore >= 3 ? 'bullish' : bearScore >= 3 ? 'bearish' : 'neutral';

  // Confidence: 60 base + indicator points
  let confidence = 60;
  if (emaBull === (direction === 'bullish')) confidence += 8;
  if (macdBull === (direction === 'bullish')) confidence += 8;
  if (bosBull || bosBear) confidence += 7;
  if (rsi > 55 || rsi < 45) confidence += 7;
  if (direction !== 'neutral') confidence += 5;
  confidence = Math.min(96, confidence);

  // ATR for zone sizing
  const atr = recentHighs.map((h, i) => h - recentLows[i]).reduce((s, v) => s + v, 0) / recentHighs.length;

  // Order Block: last significant opposing candle before the move
  const obOffset = direction === 'bullish' ? atr * 0.5 : atr * 0.3;
  const obPrice = direction === 'bullish'
    ? support + obOffset
    : resistance - obOffset;
  const obType = direction === 'bullish' ? 'bullish' : 'bearish';

  // Fair Value Gap: midpoint between swing and current (estimated)
  const fvgPrice = direction === 'bullish'
    ? price - atr * 0.6
    : price + atr * 0.6;

  // Entry zone around live price
  const entryLow  = direction === 'bullish' ? price - atr * 0.25 : price + atr * 0.10;
  const entryHigh = direction === 'bullish' ? price + atr * 0.10 : price + atr * 0.25;

  // RSI divergence text
  const rsiDivText =
    rsi < 40 && direction === 'bullish' ? 'Bullish hidden divergence' :
    rsi > 60 && direction === 'bearish' ? 'Bearish hidden divergence' :
    rsi < 35 ? 'Bullish regular divergence — oversold' :
    rsi > 65 ? 'Bearish regular divergence — overbought' :
    `RSI ${rsi.toFixed(0)} — neutral zone`;

  // Trend description
  const trendText =
    direction === 'bullish' ? `Uptrend — higher highs & lows (EMA ${ema20 > ema50 ? 'bullish' : 'neutral'} stack)` :
    direction === 'bearish' ? `Downtrend — lower highs & lows (EMA bearish stack)` :
    'Sideways consolidation — no clear directional bias';

  // Breakout potential
  const distToResist = ((resistance - price) / price) * 100;
  const distToSupport = ((price - support) / price) * 100;
  const breakoutText =
    direction === 'bullish' && distToResist < 2 ? `High — consolidation within ${distToResist.toFixed(1)}% of resistance` :
    direction === 'bullish' ? `Moderate — ${distToResist.toFixed(1)}% to resistance at $${formatPrice(resistance)}` :
    direction === 'bearish' && distToSupport < 2 ? `High — distribution within ${distToSupport.toFixed(1)}% of support` :
    direction === 'bearish' ? `Moderate — ${distToSupport.toFixed(1)}% to support at $${formatPrice(support)}` :
    'Low — price in consolidation range';

  // Summary
  const summary =
    direction === 'bullish'
      ? `Chart shows a bullish market structure. Price is ${bosBull ? 'breaking structure to the upside' : 'trading above key EMAs'} with RSI at ${rsi.toFixed(0)}. An unfilled FVG near $${formatPrice(fvgPrice)} acts as a magnet. Watch for an entry pullback into $${formatPrice(entryLow)}–$${formatPrice(entryHigh)} targeting resistance at $${formatPrice(resistance)}.`
      : direction === 'bearish'
      ? `Chart shows a bearish market structure. Price is ${bosBear ? 'breaking structure to the downside' : 'trading below key EMAs'} with RSI at ${rsi.toFixed(0)}. Distribution above $${formatPrice(fvgPrice)} creates selling pressure. Immediate support at $${formatPrice(support)} is the key level to watch.`
      : `Market is in a neutral, ranging phase between $${formatPrice(support)} and $${formatPrice(resistance)}. RSI at ${rsi.toFixed(0)} suggests no strong momentum. Wait for a clear breakout or breakdown before initiating a position.`;

  const displaySymbol = symbol.replace('USDT', '/USDT');

  return {
    symbol: displaySymbol,
    price,
    direction,
    confidence,
    trend: trendText,
    support,
    resistance,
    orderBlock: { price: obPrice, type: obType },
    fvg: { price: fvgPrice, type: 'unfilled' },
    rsiDivergence: rsiDivText,
    entryLow,
    entryHigh,
    breakoutPotential: breakoutText,
    summary,
  };
}

// Parse a symbol from a TradingView URL or raw text like "BTC", "BTCUSDT", "BTC/USDT"
function parseSymbol(raw: string): string {
  raw = raw.trim().toUpperCase();
  // TradingView URL: symbol=BINANCE:BTCUSDT or symbol=BTCUSDT
  const urlMatch = raw.match(/SYMBOL[=:]([A-Z:]+)/);
  if (urlMatch) raw = urlMatch[1].replace(/^[A-Z]+:/, '');
  // Remove exchange prefix if present
  raw = raw.replace(/^(BINANCE|BYBIT|OKX|COINBASE|KRAKEN):/i, '');
  // Normalize: BTC → BTCUSDT, BTC/USDT → BTCUSDT
  raw = raw.replace('/', '');
  if (!raw.endsWith('USDT') && !raw.endsWith('BTC') && !raw.endsWith('ETH')) {
    raw = raw + 'USDT';
  }
  return raw;
}

export function ChartAiView() {
  const coins = useLiveMarket(30000);
  const [inputValue, setInputValue] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionResult | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runAnalysis = async (symbolOverride?: string) => {
    const raw = symbolOverride ?? inputValue.trim();
    const symbol = raw ? parseSymbol(raw) : 'BTCUSDT';
    const base = symbol.replace('USDT', '');

    setAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const candles = await fetchCandles(symbol);
      if (candles.length < 20) throw new Error('Not enough data for this pair');

      // Use live price from market hook if available, else use last candle close
      const liveCoin = coins.find((c) => c.symbol === `${base}/USDT`);
      const livePrice = liveCoin?.price ?? candles[candles.length - 1].close;

      const analysis = analyzeCandles(candles, symbol, livePrice);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadedName(file.name);
    setVision(null);
    setVisionError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        // Downscale to ≤1600px JPEG to stay under payload limits
        const maxSide = 1600;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const scale = maxSide / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setVisionError('Could not process image in this browser');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1] || '';

        const symbolRaw = inputValue.trim() ? parseSymbol(inputValue.trim()) : 'BTCUSDT';

        setVisionLoading(true);
        try {
          const resp = await fetch(`${EDGE_FUNCTION_URL}?action=ai-chart`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64,
              mime: 'image/jpeg',
              symbol: symbolRaw,
              timeframe: '4H',
            }),
          });
          if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({}));
            throw new Error(errBody?.error || `HTTP ${resp.status}`);
          }
          const json = await resp.json();
          if (json?.analysis?.error) {
            setVisionError(json.analysis.error);
          } else if (json?.analysis) {
            setVision(json.analysis as VisionResult);
          } else {
            setVisionError('Empty analysis response');
          }
        } catch (err) {
          setVisionError(err instanceof Error ? err.message : 'Vision analysis failed');
        } finally {
          setVisionLoading(false);
        }
      };
      img.onerror = () => setVisionError('Could not load image file');
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => setVisionError('Could not read file');
    reader.readAsDataURL(file);
  };

  const isLong = result?.direction === 'bullish';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upload / input panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-4 w-4 text-primary" />
              AI Chart Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-secondary/20 p-8 text-center transition-colors hover:border-primary/40"
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Upload chart screenshot</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG up to 10MB — analyzed by Gemini vision AI
              </p>
              {uploadedName && !visionLoading && !vision && !visionError && (
                <p className="mt-1 text-[11px] text-primary">Reading {uploadedName}…</p>
              )}
              <Button variant="outline" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose file
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">OR</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Connect TradingView chart</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste a TradingView chart link or symbol for instant analysis.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                  placeholder="BTCUSDT, ETHUSDT, or paste TradingView URL"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <Button size="sm" onClick={() => runAnalysis()} disabled={analyzing}>
                  Fetch
                </Button>
              </div>
            </div>

            {/* Quick coins */}
            <div>
              <p className="mb-2 text-[11px] text-muted-foreground">Quick analysis:</p>
              <div className="flex flex-wrap gap-2">
                {['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX'].map((coin) => (
                  <button
                    key={coin}
                    onClick={() => { setInputValue(coin); runAnalysis(coin + 'USDT'); }}
                    className="rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {coin}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => runAnalysis()}
              disabled={analyzing}
            >
              {analyzing ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" /> Analyzing chart…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Run AI Analysis
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-accent" />
                AI Detection Results
              </CardTitle>
              {result && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  {result.symbol} · live
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Gemini vision analysis — shown first when a chart was uploaded */}
            {(visionLoading || visionError || vision) && (
              <div className="mb-4 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Gemini Vision (uploaded chart)
                </div>
                {visionLoading && (
                  <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    Sending image to Gemini vision…
                  </div>
                )}
                {visionError && !visionLoading && (
                  <p className="py-2 text-xs text-destructive">{visionError}</p>
                )}
                {vision && !visionLoading && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {vision.bias === 'bullish' ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : vision.bias === 'bearish' ? (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      ) : (
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold capitalize">{vision.bias}</span>
                      <Badge variant="outline" className={cn(
                        vision.bias === 'bullish' ? 'border-success/40 text-success' :
                        vision.bias === 'bearish' ? 'border-destructive/40 text-destructive' :
                        'border-border text-muted-foreground'
                      )}>
                        {vision.confidence ?? 50}% confidence
                      </Badge>
                    </div>
                    {vision.summary && (
                      <p className="text-xs leading-relaxed text-muted-foreground">{vision.summary}</p>
                    )}
                    {(vision.key_levels?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {vision.key_levels.map((kl, i) => (
                          <Badge key={i} variant="outline" className={cn(
                            'text-[10px]',
                            kl.type === 'support' ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'
                          )}>
                            {kl.type === 'support' ? 'S' : 'R'} ${formatPrice(kl.price)} · {kl.strength}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {(vision.order_blocks?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        OB: {vision.order_blocks.map((o) => `${o.type} ${o.zone}`).join(' · ')}
                      </p>
                    )}
                    {(vision.fvg?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        FVG: {vision.fvg.map((f) => `${f.type} ${f.zone}`).join(' · ')}
                      </p>
                    )}
                    {(vision.entry_zones?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Entry zones: {vision.entry_zones.map((z) => `$${formatPrice(z)}`).join(', ')}
                      </p>
                    )}
                    {(vision.risk_notes?.length ?? 0) > 0 && (
                      <ul className="list-inside list-disc space-y-0.5">
                        {vision.risk_notes.map((r, i) => (
                          <li key={i} className="text-[11px] text-warning">{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {!result && !analyzing && !error && !visionLoading && !vision && !visionError && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
                <ScanLine className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Upload a chart or enter a symbol to begin</p>
                <p className="mt-1 text-xs">AI will compute live S/R, order blocks, FVGs, and entry zones</p>
              </div>
            )}

            {analyzing && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <div className="h-16 w-16 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  <ScanLine className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Fetching live candles & scanning patterns…</p>
                <p className="mt-1 text-xs text-muted-foreground">Computing SMC structures, indicators, and entry zones</p>
              </div>
            )}

            {error && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <AlertTriangle className="mb-3 h-10 w-10 text-warning opacity-50" />
                <p className="text-sm font-medium">Analysis failed</p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => runAnalysis()}>
                  Retry
                </Button>
              </div>
            )}

            {result && !analyzing && (
              <div className="animate-fade-in space-y-3">
                {/* Setup banner */}
                <div className={cn(
                  'flex items-center justify-between rounded-lg border p-3',
                  result.direction === 'bullish' ? 'border-success/30 bg-success/5' :
                  result.direction === 'bearish' ? 'border-destructive/30 bg-destructive/5' :
                  'border-border bg-secondary/30'
                )}>
                  <div className="flex items-center gap-2">
                    {result.direction === 'bullish' ? (
                      <TrendingUp className="h-5 w-5 text-success" />
                    ) : result.direction === 'bearish' ? (
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    ) : (
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-semibold">
                      {result.direction === 'bullish' ? 'Bullish Setup Detected' :
                       result.direction === 'bearish' ? 'Bearish Setup Detected' :
                       'Neutral — No Clear Setup'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">
                      ${formatPrice(result.price)}
                    </span>
                    <Badge variant="outline" className={cn(
                      result.direction === 'bullish' ? 'border-success/40 text-success' :
                      result.direction === 'bearish' ? 'border-destructive/40 text-destructive' :
                      'border-border text-muted-foreground'
                    )}>
                      {result.confidence}% confidence
                    </Badge>
                  </div>
                </div>

                <DetectionRow
                  icon={isLong ? TrendingUp : TrendingDown}
                  label="Trend Direction"
                  value={result.trend}
                  tone={result.direction === 'bullish' ? 'success' : result.direction === 'bearish' ? 'destructive' : 'neutral'}
                />
                <DetectionRow
                  icon={Target}
                  label="Support"
                  value={`$${formatPrice(result.support)} (4H swing low)`}
                  tone="success"
                />
                <DetectionRow
                  icon={Target}
                  label="Resistance"
                  value={`$${formatPrice(result.resistance)} (4H swing high)`}
                  tone="destructive"
                />
                <DetectionRow
                  icon={Layers}
                  label="Order Block"
                  value={`${result.orderBlock.type === 'bullish' ? 'Bullish' : 'Bearish'} OB at $${formatPrice(result.orderBlock.price)}`}
                  tone={result.orderBlock.type === 'bullish' ? 'success' : 'destructive'}
                />
                <DetectionRow
                  icon={Layers}
                  label="Fair Value Gap"
                  value={`${result.fvg.type === 'unfilled' ? 'Unfilled' : 'Filled'} FVG at $${formatPrice(result.fvg.price)}`}
                  tone="primary"
                />
                <DetectionRow
                  icon={Activity}
                  label="RSI Divergence"
                  value={result.rsiDivergence}
                  tone={result.direction === 'bullish' ? 'success' : result.direction === 'bearish' ? 'destructive' : 'neutral'}
                />
                <DetectionRow
                  icon={Target}
                  label="Entry Zone"
                  value={`$${formatPrice(result.entryLow)} – $${formatPrice(result.entryHigh)}`}
                  tone="primary"
                />
                <DetectionRow
                  icon={TrendingUp}
                  label="Breakout Potential"
                  value={result.breakoutPotential}
                  tone={result.direction === 'bullish' ? 'success' : result.direction === 'bearish' ? 'destructive' : 'neutral'}
                />

                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    AI Summary
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{result.summary}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetectionRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: 'success' | 'destructive' | 'primary' | 'neutral';
}) {
  const colors = {
    success: 'text-success',
    destructive: 'text-destructive',
    primary: 'text-primary',
    neutral: 'text-muted-foreground',
  };
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
      <div className="flex items-center gap-2 shrink-0">
        <Icon className={cn('h-4 w-4', colors[tone])} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="ml-2 text-right text-xs text-muted-foreground">{value}</span>
    </div>
  );
}
