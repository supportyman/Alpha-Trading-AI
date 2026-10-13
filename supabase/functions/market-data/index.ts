import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const BINANCE_API = "https://api.binance.com/api/v3";

// ---- Free-tier API protection: per-isolate TTL cache ----
type CacheEntry = { t: number; v: unknown };
const CACHE: Map<string, CacheEntry> =
  ((globalThis as any).__marketDataCache ?? ((globalThis as any).__marketDataCache = new Map()));

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T;
  const v = await fn();
  CACHE.set(key, { t: Date.now(), v });
  return v;
}

// Cached wrappers — original function bodies untouched (renamed to *Raw below)
const fetchTickers = () => cached("tickers", 5_000, fetchTickersRaw);
const fetchSentiment = () => cached("sentiment", 30_000, fetchSentimentRaw);
const fetchCryptoNews = () => cached("news", 120_000, fetchCryptoNewsRaw);
const fetchEconomicCalendar = () => cached("calendar", 300_000, fetchEconomicCalendarRaw);
const fetchBinanceKlines = (symbol: string, interval: string, limit = 200) =>
  cached(`klines:${symbol}:${interval}:${limit}`, 10_000, () =>
    fetchBinanceKlinesRaw(symbol, interval, limit));

const COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  BNB: "binancecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  DOGE: "dogecoin",
  DOT: "polkadot",
  MATIC: "matic-network",
  ARB: "arbitrum",
  OP: "optimism",
  INJ: "injective-protocol",
  SUI: "sui",
};

const SYMBOL_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP",
  BNB: "BNB", ADA: "Cardano", AVAX: "Avalanche", LINK: "Chainlink",
  DOGE: "Dogecoin", DOT: "Polkadot", MATIC: "Polygon",
  ARB: "Arbitrum", OP: "Optimism", INJ: "Injective", SUI: "Sui",
};

const BASES = Object.keys(COIN_IDS);

// Binance uses different interval codes than our internal labels
const BINANCE_INTERVALS: Record<string, string> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "60": "1h",
  "240": "4h",
  "1440": "1d",
  "10080": "1w",
};

interface CGCoin {
  id: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
  total_volume: number;
  market_cap: number;
  sparkline_in_7d?: { price: number[] };
}

interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
}

async function fetchTickersRaw(): Promise<Record<string, {
  price: number; change24h: number; high24h: number; low24h: number;
  volume24h: number; marketCap: number; sparkline: number[];
}>> {
  const ids = Object.values(COIN_IDS).join(",");
  const url = `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`CoinGecko markets failed: ${resp.status}`);
  const data = (await resp.json()) as CGCoin[];
  const map: Record<string, any> = {};
  for (const c of data) {
    const base = c.symbol.toUpperCase();
    map[base] = {
      price: c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
      high24h: c.high_24h ?? c.current_price,
      low24h: c.low_24h ?? c.current_price,
      volume24h: c.total_volume ?? 0,
      marketCap: c.market_cap ?? 0,
      sparkline: c.sparkline_in_7d?.price?.slice(-24) || [c.current_price],
    };
  }
  return map;
}

async function fetchBinanceKlinesRaw(symbol: string, interval: string, limit = 200): Promise<{
  candles: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
}> {
  const binanceSymbol = `${symbol}USDT`;
  const bnInterval = BINANCE_INTERVALS[interval] || "4h";
  const url = `${BINANCE_API}/klines?symbol=${binanceSymbol}&interval=${bnInterval}&limit=${limit}`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`Binance klines failed: ${resp.status}`);
  const raw = (await resp.json()) as unknown[][];

  const candles = raw.map((r) => ({
    time: String(r[0] as number),
    open: parseFloat(r[1] as string),
    high: parseFloat(r[2] as string),
    low: parseFloat(r[3] as string),
    close: parseFloat(r[4] as string),
    volume: parseFloat(r[5] as string),
  }));

  return { candles };
}

function moodFromScore(score: number): string {
  if (score < 25) return "Extreme Fear";
  if (score < 45) return "Fear";
  if (score < 55) return "Neutral";
  if (score < 75) return "Greed";
  return "Extreme Greed";
}

async function fetchBinanceTickers(): Promise<Record<string, { change24h: number; volume24h: number }>> {
  const symbols = BASES.map((b) => `"${b}USDT"`).join(",");
  const url = `${BINANCE_API}/ticker/24hr?symbols=[${symbols}]`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`Binance ticker failed: ${resp.status}`);
  const data = (await resp.json()) as { symbol: string; priceChangePercent: string; quoteVolume: string }[];
  const map: Record<string, { change24h: number; volume24h: number }> = {};
  for (const item of data) {
    const base = item.symbol.replace("USDT", "");
    map[base] = {
      change24h: parseFloat(item.priceChangePercent),
      volume24h: parseFloat(item.quoteVolume),
    };
  }
  return map;
}

async function fetchSentimentRaw() {
  // Try CoinGecko first; fall back to Binance 24h tickers (no rate-limit auth needed)
  let tickers: Record<string, { change24h: number; volume24h: number; price?: number }>;
  try {
    tickers = await fetchTickers();
  } catch {
    tickers = await fetchBinanceTickers();
  }
  const changes: number[] = [];
  const volumes: number[] = [];
  const topCoins: { symbol: string; sentiment: number; mentions: number }[] = [];

  for (const base of BASES) {
    const t = tickers[base];
    if (!t) continue;
    changes.push(t.change24h);
    volumes.push(t.volume24h);

    // Per-coin sentiment from 24h change and volume
    const coinSent = Math.max(0, Math.min(100, Math.round(50 + t.change24h * 2.5)));
    topCoins.push({
      symbol: base,
      sentiment: coinSent,
      mentions: Math.round(t.volume24h / 10000),
    });
  }

  // Overall Fear & Greed from average change (momentum) + volume surge
  const avgChange = changes.length > 0
    ? changes.reduce((s, c) => s + c, 0) / changes.length
    : 0;
  const totalVolume = volumes.reduce((s, v) => s + v, 0);
  const avgVolume = totalVolume / Math.max(volumes.length, 1);

  let score = 50 + avgChange * 3;
  // Volume surge bonus: high volume + positive change = greed
  if (avgVolume > 500_000_000) score += avgChange > 0 ? 6 : -6;

  // Breadth: how many coins are green
  const greenCount = changes.filter((c) => c > 0).length;
  const breadth = (greenCount / Math.max(changes.length, 1)) * 100;
  score = score * 0.6 + breadth * 0.4;

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Source breakdown — derived from different aspects of market data
  const twitterScore = Math.max(0, Math.min(100, Math.round(50 + avgChange * 3.2)));
  const redditScore = Math.max(0, Math.min(100, Math.round(50 + avgChange * 2.5 + (breadth - 50) * 0.3)));
  const telegramScore = Math.max(0, Math.min(100, Math.round(50 + avgChange * 2.8)));
  const newsScore = Math.max(0, Math.min(100, Math.round(50 + avgChange * 2 + (greenCount > changes.length / 2 ? 8 : -8))));

  // Trending narratives — derived from top movers
  const sorted = [...BASES]
    .map((base) => ({ base, change: tickers[base]?.change24h ?? 0, vol: tickers[base]?.volume24h ?? 0 }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const trendingTopics: Record<string, string> = {
    BTC: "BTC ETF Flows",
    ETH: "ETH Staking",
    SOL: "Solana DeFi",
    XRP: "XRP Ledger",
    BNB: "BNB Chain",
    ADA: "Cardano Updates",
    AVAX: "Avalanche Gaming",
    LINK: "Chainlink CCIP",
    DOGE: "Dogecoin Momentum",
    DOT: "Polkadot Interop",
  };

  const trending = sorted.slice(0, 5).map((s) => ({
    topic: trendingTopics[s.base] || `${s.base} Activity`,
    mentions: Math.round(s.vol / 10000),
    change: Math.round(s.change),
  }));

  topCoins.sort((a, b) => b.mentions - a.mentions);

  // Real Fear & Greed index — alternative.me (free public API, updated daily)
  let fng: { value: number; label: string; source: string } | null = null;
  try {
    const fngResp = await fetch("https://api.alternative.me/fng/?limit=1", {
      headers: { Accept: "application/json" },
    });
    if (fngResp.ok) {
      const fngData = await fngResp.json() as { data?: { value?: string; value_classification?: string }[] };
      const d = fngData?.data?.[0];
      if (d?.value) {
        fng = {
          value: parseInt(d.value, 10),
          label: d.value_classification || "",
          source: "alternative.me",
        };
      }
    }
  } catch {
    // keep fng = null; client falls back to the derived score
  }

  return {
    score,
    mood: moodFromScore(score),
    fng,
    twitter: twitterScore,
    reddit: redditScore,
    telegram: telegramScore,
    news: newsScore,
    trending,
    topCoins: topCoins.slice(0, 5),
  };
}

async function fetchCryptoNewsRaw(): Promise<{
  id: string; title: string; source: string; sentiment: "bullish" | "bearish" | "neutral";
  impact: "high" | "medium" | "low"; time: string; category: string; summary: string; url: string;
}[]> {
  const macroKeywords = [
    "fed", "fomc", "rate cut", "rate hike", "interest rate", "cpi", "pce",
    "inflation", "jobs report", "nonfarm", "non-farm", "nfp", "unemployment",
    "jobless claims", "powell", "yellen", "treasury", "gdp", "pmi",
    "recession", "soft landing", "monetary policy", "economic data",
    "consumer price index", "producer price index", "ppi",
  ];

  function classifyNews(title: string, body: string, categories: string, sourceName: string, publishedOn: number, url: string, id: string) {
    const now = Math.floor(Date.now() / 1000);
    const ageSec = now - publishedOn;
    let time: string;
    if (ageSec < 60) time = "just now";
    else if (ageSec < 3600) time = `${Math.floor(ageSec / 60)}m ago`;
    else if (ageSec < 86400) time = `${Math.floor(ageSec / 3600)}h ago`;
    else time = `${Math.floor(ageSec / 86400)}d ago`;

    const cats = (categories || "").split("|").map((c: string) => c.trim()).filter(Boolean);
    const titleLower = (title || "").toLowerCase();
    const bodyLower = (body || "").toLowerCase().slice(0, 500);

    let category = "Market";
    const categoryKeywords: Record<string, string[]> = {
      "ETF": ["etf", "spot bitcoin", "spot eth"],
      "Regulation": ["sec", "regulation", "regulated", "compliance", "lawsuit", "ban", "sanction"],
      "On-Chain": ["whale", "on-chain", "defi", "staking", "bridge", "hack", "exploit", "nft"],
      "Macro": macroKeywords,
    };
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => titleLower.includes(kw) || bodyLower.includes(kw))) {
        category = cat;
        break;
      }
    }

    let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
    if (titleLower.includes("surge") || titleLower.includes("rally") || titleLower.includes("soar") || titleLower.includes("bull") || titleLower.includes("pump") || titleLower.includes("inflow") || titleLower.includes("breakout") || titleLower.includes("record") || titleLower.includes("high")) sentiment = "bullish";
    else if (titleLower.includes("crash") || titleLower.includes("plunge") || titleLower.includes("dump") || titleLower.includes("bear") || titleLower.includes("outflow") || titleLower.includes("sell") || titleLower.includes("ban") || titleLower.includes("hack") || titleLower.includes("lawsuit") || titleLower.includes("drop") || titleLower.includes("fall")) sentiment = "bearish";
    if (category === "Macro" && sentiment === "neutral") {
      if (titleLower.includes("rate cut") || titleLower.includes("dovish") || titleLower.includes("pivot") || titleLower.includes("pause")) {
        sentiment = "bullish";
      } else if (titleLower.includes("rate hike") || titleLower.includes("hawkish") || titleLower.includes("hot inflation") || titleLower.includes("hot cpi")) {
        sentiment = "bearish";
      }
    }

    const impact: "high" | "medium" | "low" = category === "Macro" ? "high" : cats.length > 4 ? "high" : cats.length > 2 ? "medium" : "low";

    return {
      id, title, source: sourceName, sentiment, impact, time, category,
      summary: body.slice(0, 280) + (body.length > 280 ? "…" : ""),
      url,
    };
  }

  // Fetch news from multiple free RSS feeds directly (parse XML, no proxy needed)
  const feeds: { name: string; url: string }[] = [
    { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
    { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
    { name: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
    { name: "Decrypt", url: "https://decrypt.co/feed" },
  ];

  const allNews: { news: ReturnType<typeof classifyNews>; ts: number }[] = [];

  for (const feed of feeds) {
    try {
      const resp = await fetch(feed.url, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
        redirect: "follow",
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      if (!xml || xml.length < 100) continue;

      // Parse RSS <item> elements with regex (no DOM parser in Deno edge runtime)
      const itemRegex = /<item[\s\S]*?<\/item>/gi;
      const items = xml.match(itemRegex);
      if (!items || items.length === 0) continue;

      for (const itemXml of items.slice(0, 15)) {
        const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i) || itemXml.match(/<link[^>]*href="([^"]*)"[^>]*\/>/i);
        const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const catMatches = itemXml.matchAll(/<category>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/gi);

        const title = titleMatch ? titleMatch[1].trim() : "";
        const link = linkMatch ? linkMatch[1].trim() : "";
        const desc = descMatch ? descMatch[1].replace(/<[^>]*>/g, "").trim() : "";
        const pubDate = dateMatch ? dateMatch[1].trim() : "";
        const categories = Array.from(catMatches).map((m) => m[1].trim()).join("|");

        if (!title || !link) continue;

        const publishedOn = Math.floor(new Date(pubDate).getTime() / 1000);
        if (isNaN(publishedOn)) continue;

        const id = `${feed.name}-${publishedOn}-${title.length}`;
        const news = classifyNews(title, desc, categories, feed.name, publishedOn, link, id);
        allNews.push({ news, ts: publishedOn });
      }
    } catch {
      // Skip failed feed
    }
  }

  if (allNews.length > 0) {
    // Sort by most recent first, dedupe by title
    const seen = new Set<string>();
    const deduped = allNews
      .sort((a, b) => b.ts - a.ts)
      .map((n) => n.news)
      .filter((n) => {
        const key = n.title.toLowerCase().slice(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return deduped.slice(0, 40);
  }

  throw new Error("All news sources unreachable");
}

// ── Economic calendar: live data from ForexFactory free JSON feed ──

interface FFEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

const SOURCE_URLS: Record<string, string> = {
  "FOMC Meeting Minutes": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  "Fed Interest Rate Decision": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  "Fed Chair Press Conference": "https://www.federalreserve.gov/press.htm",
  "CPI m/m": "https://www.bls.gov/cpi/",
  "CPI y/y": "https://www.bls.gov/cpi/",
  "Core CPI m/m": "https://www.bls.gov/cpi/",
  "Core CPI y/y": "https://www.bls.gov/cpi/",
  "Core PCE Price Index m/m": "https://www.bea.gov/data/personal-income-expenditures/price-indexes-personal-consumption-expenditures",
  "Core PCE Price Index y/y": "https://www.bea.gov/data/personal-income-expenditures/price-indexes-personal-consumption-expenditures",
  "PCE Price Index m/m": "https://www.bea.gov/data/personal-income-expenditures/price-indexes-personal-consumption-expenditures",
  "Non-Farm Payrolls": "https://www.bls.gov/ces/",
  "Unemployment Rate": "https://www.bls.gov/cps/",
  "Unemployment Claims": "https://oui.doleta.gov/unemploy/claims.asp",
  "GDP q/q": "https://www.bea.gov/data/gdp/gdp",
  "GDP q/q Annualized": "https://www.bea.gov/data/gdp/gdp",
  "PPI m/m": "https://www.bls.gov/ppi/",
  "Retail Sales m/m": "https://www.census.gov/retail/",
  "ISM Manufacturing PMI": "https://www.ismworld.org/supply-management-news-and-reports/",
  "Consumer Confidence": "https://www.conference-board.org/topics/consumer-confidence",
  "All Car Sales": "https://www.bea.gov/data/income-saving/personal-consumption-expenditures",
  "Crude Oil Inventories": "https://www.eia.gov/petroleum/supply/weekly/",
};

const SOURCE_NAMES: Record<string, string> = {
  "FOMC Meeting Minutes": "Federal Reserve",
  "Fed Interest Rate Decision": "Federal Reserve",
  "Fed Chair Press Conference": "Federal Reserve",
  "CPI m/m": "Bureau of Labor Statistics",
  "CPI y/y": "Bureau of Labor Statistics",
  "Core CPI m/m": "Bureau of Labor Statistics",
  "Core CPI y/y": "Bureau of Labor Statistics",
  "Core PCE Price Index m/m": "BEA",
  "Core PCE Price Index y/y": "BEA",
  "PCE Price Index m/m": "BEA",
  "Non-Farm Payrolls": "Bureau of Labor Statistics",
  "Unemployment Rate": "Bureau of Labor Statistics",
  "Unemployment Claims": "DOL",
  "GDP q/q": "BEA",
  "GDP q/q Annualized": "BEA",
  "PPI m/m": "BLS",
  "Retail Sales m/m": "Census Bureau",
  "ISM Manufacturing PMI": "ISM",
  "Consumer Confidence": "Conference Board",
  "Crude Oil Inventories": "EIA",
};

function ffImpactToOurImpact(impact: string): "high" | "medium" | "low" {
  const lower = impact.toLowerCase();
  if (lower.includes("high") || lower.includes("red") || lower.includes("3")) return "high";
  if (lower.includes("medium") || lower.includes("orange") || lower.includes("2") || lower.includes("holiday")) return "medium";
  return "low";
}

async function fetchEconomicCalendarRaw(): Promise<{
  id: string; title: string; country: string; currency: string;
  impact: "high" | "medium" | "low"; time: string; date: string;
  actual: string | null; forecast: string | null; previous: string | null;
  source: string; url: string;
}[]> {
  // ForexFactory provides a free JSON calendar feed (no API key needed)
  // Fetch this week + next week to cover upcoming + recent events
  const urls = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
  ];

  const allEvents: FFEvent[] = [];

  for (const feedUrl of urls) {
    try {
      const resp = await fetch(feedUrl, { headers: { Accept: "application/json" } });
      if (!resp.ok) continue;
      const data = await resp.json() as FFEvent[];
      if (Array.isArray(data)) {
        allEvents.push(...data);
      }
    } catch {
      // Skip failed feeds
    }
  }

  // Fallback: try ForexFactory calendar via rss2json proxy
  if (allEvents.length === 0) {
    try {
      const altUrl = "https://nfs.faireconomy.media/ff_calendar.json";
      const resp = await fetch(altUrl, { headers: { Accept: "application/json" } });
      if (resp.ok) {
        const data = await resp.json() as FFEvent[];
        if (Array.isArray(data)) {
          allEvents.push(...data);
        }
      }
    } catch {
      // All calendar sources failed
    }
  }

  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);
  const twoWeeksAhead = new Date(now);
  twoWeeksAhead.setDate(now.getDate() + 14);

  const seen = new Set<string>();
  const events = allEvents
    .filter((e) => {
      // ForexFactory uses "country" field with values like "USD", "EUR", etc.
      if (e.country !== "USD") return false;
      const eventDate = new Date(e.date);
      if (isNaN(eventDate.getTime())) return false;
      if (eventDate < twoWeeksAgo || eventDate > twoWeeksAhead) return false;
      // Dedupe
      const key = `${e.title}-${e.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((e, i) => {
      const eventDate = new Date(e.date);
      const dateStr = eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Karachi" });
      // ForexFactory embeds time in the date field; extract it in Pakistan time (Asia/Karachi, UTC+5)
      const timeStr = eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" });

      const impact = ffImpactToOurImpact(e.impact || "");
      const sourceName = SOURCE_NAMES[e.title] || "ForexFactory";
      const sourceUrl = SOURCE_URLS[e.title] || "https://www.forexfactory.com/calendar";

      return {
        id: `econ-${i}-${e.title.replace(/\s/g, "-")}`,
        title: e.title,
        country: e.country || "USD",
        currency: e.country || "USD",
        impact,
        time: timeStr,
        date: dateStr,
        timestamp: eventDate.getTime(),
        actual: e.actual && e.actual.trim() !== "" ? e.actual : null,
        forecast: e.forecast && e.forecast.trim() !== "" ? e.forecast : null,
        previous: e.previous && e.previous.trim() !== "" ? e.previous : null,
        source: sourceName,
        url: sourceUrl,
      };
    })
    .sort((a, b) => {
      // Upcoming first, then by chronological date
      const aUpcoming = a.actual === null ? 0 : 1;
      const bUpcoming = b.actual === null ? 0 : 1;
      if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
      return 0;
    });

  return events;
}

// ── AI Chat: Build system prompt with live market context ──────────────────

function buildSystemPrompt(ctx: any): string {
  const parts: string[] = [
    "You are an expert cryptocurrency trading assistant integrated into a live trading platform.",
    "You have access to real-time market data and technical analysis.",
    "Answer questions about trading strategies, market analysis, risk management, crypto fundamentals, DeFi, and general crypto questions.",
    "Be concise but thorough. Use markdown formatting with **bold** for key points and bullet points where helpful.",
    "When discussing specific coins, always remind users that this is not financial advice and they should do their own research.",
    "Never give guaranteed profit predictions. Always discuss risk.",
    "",
  ];

  if (ctx.symbol) {
    parts.push(`Currently selected coin: ${ctx.symbol}`);
  }
  if (ctx.timeframe) {
    const tfMap: Record<string, string> = { "5": "5m", "15": "15m", "60": "1H", "240": "4H", "1440": "1D", "10080": "1W" };
    parts.push(`Selected timeframe: ${tfMap[ctx.timeframe] || ctx.timeframe}`);
  }

  if (ctx.analysis) {
    parts.push("", "Live technical analysis for the selected coin:", ctx.analysis);
  }

  if (ctx.coins && Array.isArray(ctx.coins) && ctx.coins.length > 0) {
    parts.push("", "Live market data (top coins):");
    for (const c of ctx.coins.slice(0, 12)) {
      parts.push(
        `• ${c.symbol}: ${c.price?.toLocaleString() || "N/A"} (${c.change24h >= 0 ? "+" : ""}${c.change24h?.toFixed(2) || 0}% 24h)`,
      );
    }
  }

  if (ctx.news && Array.isArray(ctx.news) && ctx.news.length > 0) {
    parts.push("", "Latest crypto news headlines:");
    for (const n of ctx.news.slice(0, 8)) {
      parts.push(`• [${n.source}] ${n.title} (${n.sentiment})`);
    }
  }

  return parts.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "tickers";

    if (action === "tickers") {
      const tickers = await fetchTickers();
      const coins = BASES.map((base) => {
        const t = tickers[base];
        if (!t) return null;
        return {
          symbol: `${base}/USDT`,
          binanceSymbol: `${base}USDT`,
          name: SYMBOL_NAMES[base] || base,
          price: t.price,
          change24h: t.change24h,
          volume24h: t.volume24h,
          high24h: t.high24h,
          low24h: t.low24h,
          marketCap: t.marketCap,
          sparkline: t.sparkline,
        };
      }).filter(Boolean);

      return new Response(JSON.stringify({ coins }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "global") {
      // Real global market data — CoinGecko /global (free)
      try {
        const g = await cached("global-market", 60_000, async () => {
          const resp = await fetch(`${COINGECKO_API}/global`, { headers: { Accept: "application/json" } });
          if (!resp.ok) throw new Error(`CoinGecko /global failed: ${resp.status}`);
          const payload = await resp.json() as { data?: Record<string, any> };
          const d = payload.data || {};
          return {
            marketCap: d.total_market_cap?.usd ?? null,
            volume24h: d.total_volume?.usd ?? null,
            btcDominance: d.market_cap_percentage?.btc ?? null,
            ethDominance: d.market_cap_percentage?.eth ?? null,
            marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? null,
            activeCoins: d.active_cryptocurrencies ?? null,
            updatedAt: d.updated_at ?? null,
            source: "CoinGecko",
          };
        });
        return new Response(JSON.stringify(g), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (globalErr) {
        return new Response(
          JSON.stringify({ error: globalErr instanceof Error ? globalErr.message : "Global data failed" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (action === "trending") {
      // Real trending coins — CoinGecko /search/trending (free)
      try {
        const t = await cached("coingecko-trending", 300_000, async () => {
          const resp = await fetch(`${COINGECKO_API}/search/trending`, { headers: { Accept: "application/json" } });
          if (!resp.ok) throw new Error(`CoinGecko trending failed: ${resp.status}`);
          const payload = await resp.json() as { coins?: any[] };
          const coins = (payload.coins || []).slice(0, 7).map((c: any) => ({
            id: c.item?.id ?? null,
            symbol: c.item?.symbol ?? "",
            name: c.item?.name ?? "",
            rank: c.item?.market_cap_rank ?? null,
            price: c.item?.data?.price ?? null,
            change24h: c.item?.data?.price_change_percentage_24h ?? null,
            volume: c.item?.data?.total_volume ?? null,
          }));
          return { coins, source: "CoinGecko trending searches" };
        });
        return new Response(JSON.stringify(t), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (trendErr) {
        return new Response(
          JSON.stringify({ error: trendErr instanceof Error ? trendErr.message : "Trending failed" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (action === "klines") {
      const symbol = (url.searchParams.get("symbol") || "BTCUSDT").replace("USDT", "").toUpperCase();
      const tf = url.searchParams.get("timeframe") || "240";
      // Use Binance for real OHLCV data (CoinGecko free OHLC has no volume)
      try {
        const result = await fetchBinanceKlines(symbol, tf, 200);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (binanceErr) {
        // Fallback to CoinGecko OHLC if Binance fails (e.g. symbol not listed)
        const coinId = COIN_IDS[symbol] || "bitcoin";
        const cgUrl = `${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=usd&days=30`;
        const cgResp = await fetch(cgUrl, { headers: { Accept: "application/json" } });
        if (!cgResp.ok) throw new Error(`Both Binance and CoinGecko failed: ${binanceErr}`);
        const raw = (await cgResp.json()) as number[][];
        const candles = raw.map((r) => ({
          time: String(r[0]),
          open: r[1],
          high: r[2],
          low: r[3],
          close: r[4],
          volume: 0,
        }));
        return new Response(JSON.stringify({ candles }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "sentiment") {
      const sentiment = await fetchSentiment();
      return new Response(JSON.stringify(sentiment), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "news") {
      try {
        const news = await fetchCryptoNews();
        return new Response(JSON.stringify({ news }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (newsErr) {
        return new Response(
          JSON.stringify({ error: newsErr instanceof Error ? newsErr.message : "News fetch failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (action === "ai-chat") {
      // POST body: { messages: [{role, content}], context: { symbol, timeframe, analysis, coins } }
      let body: any = null;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const messages = body?.messages as { role: string; content: string }[] | undefined;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return new Response(JSON.stringify({ error: "No messages provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read Gemini API key from database (stored securely, not in env)
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      let geminiKey = Deno.env.get("GEMINI_API_KEY");

      if (!geminiKey && supabaseUrl && serviceKey) {
        try {
          const dbResp = await fetch(`${supabaseUrl}/rest/v1/ai_config?key_name=eq.GEMINI_API_KEY&select=key_value`, {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
          });
          if (dbResp.ok) {
            const rows = await dbResp.json() as { key_value: string }[];
            if (rows.length > 0 && rows[0].key_value) {
              geminiKey = rows[0].key_value;
            }
          }
        } catch {
          // DB read failed, continue without key
        }
      }

      if (!geminiKey) {
        return new Response(JSON.stringify({
          reply: "I'm currently running in offline mode without AI integration. I can still analyze charts, indicators, and market structure — try asking me to analyze a specific coin or scan for signals.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Build system context from the live market data passed in
      const ctx = body?.context || {};
      const systemPrompt = buildSystemPrompt(ctx);

      // Convert chat messages to Gemini format
      const contents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I'm ready to help with trading analysis and questions." }] },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      ];

      const geminiModels = ["gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-3.5-flash-lite"];
      let reply = "";

      for (const model of geminiModels) {
        try {
          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 2048,
                  topP: 0.95,
                },
              }),
            }
          );

          if (!geminiResp.ok) {
            const errText = await geminiResp.text();
            console.error(`Gemini API error (${model}):`, geminiResp.status, errText);
            continue; // try next model
          }

          const gemData = await geminiResp.json();
          reply = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (reply) break;
        } catch (modelErr) {
          console.error(`Gemini fetch error (${model}):`, modelErr);
          continue; // try next model
        }
      }

      if (!reply) {
        reply = "I'm having trouble connecting to the AI service right now. I can still do technical analysis — try asking me to analyze a specific coin or scan for RSI levels.";
      }

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ai-chart") {
      // POST body: { image: "<base64 without data: prefix>", mime: "image/png", symbol?: "BTC/USDT", timeframe?: "4H" }
      let body: any = null;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageB64 = typeof body?.image === "string" ? body.image.replace(/^data:[^,]+,/, "") : "";
      if (!imageB64) {
        return new Response(JSON.stringify({ error: "Missing image (base64)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (imageB64.length > 14_000_000) {
        return new Response(JSON.stringify({ error: "Image too large (max ~10MB)" }), {
          status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Gemini key — same loader order as ai-chat (env secret, else ai_config table)
      const chartSupabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const chartServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      let chartGeminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!chartGeminiKey && chartSupabaseUrl && chartServiceKey) {
        try {
          const dbResp = await fetch(`${chartSupabaseUrl}/rest/v1/ai_config?key_name=eq.GEMINI_API_KEY&select=key_value`, {
            headers: {
              apikey: chartServiceKey,
              Authorization: `Bearer ${chartServiceKey}`,
              "Content-Type": "application/json",
            },
          });
          if (dbResp.ok) {
            const rows = await dbResp.json() as { key_value: string }[];
            if (rows.length > 0 && rows[0].key_value) chartGeminiKey = rows[0].key_value;
          }
        } catch { /* fall through */ }
      }

      if (!chartGeminiKey) {
        return new Response(JSON.stringify({ error: "AI vision is not configured (no Gemini key)" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chartSymbol = typeof body?.symbol === "string" && body.symbol ? body.symbol : "this market";
      const chartTf = typeof body?.timeframe === "string" && body.timeframe ? ` on the ${body.timeframe} timeframe` : "";
      const chartPrompt =
        `You are a professional crypto trading analyst. Analyze this trading chart screenshot for ${chartSymbol}${chartTf}. ` +
        `Respond ONLY with a raw JSON object (no markdown fences, no commentary) in exactly this shape: ` +
        `{"bias":"bullish"|"bearish"|"neutral","confidence":0-100,"summary":"2-3 sentence overview",` +
        `"key_levels":[{"price":number,"type":"support"|"resistance","strength":"strong"|"moderate"|"weak"}],` +
        `"order_blocks":[{"type":"bullish"|"bearish","zone":"$x - $y"}],` +
        `"fvg":[{"type":"bullish"|"bearish","zone":"$x - $y"}],` +
        `"entry_zones":[number],"risk_notes":["short warning"]}. ` +
        `Use the actual price levels visible on the chart. If the image is not a recognizable trading chart, ` +
        `respond with exactly: {"error":"Not a recognizable trading chart"}.`;

      const chartContents = [
        {
          role: "user",
          parts: [
            { text: chartPrompt },
            { inline_data: { mime_type: (typeof body?.mime === "string" && body.mime) || "image/png", data: imageB64 } },
          ],
        },
      ];

      const chartModels = ["gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-3.5-flash-lite"];
      let chartReply = "";

      for (const model of chartModels) {
        try {
          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${chartGeminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: chartContents,
                generationConfig: { temperature: 0.2, maxOutputTokens: 2048, topP: 0.95 },
              }),
            },
          );
          if (!geminiResp.ok) continue;
          const gemData = await geminiResp.json();
          chartReply = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (chartReply) break;
        } catch { /* try next model */ }
      }

      if (!chartReply) {
        return new Response(JSON.stringify({ error: "AI vision service unavailable — try again shortly" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Strip markdown fences if the model added them, then parse
      const cleaned = chartReply.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
      let analysis: unknown = null;
      try { analysis = JSON.parse(cleaned); } catch { analysis = { summary: cleaned, bias: "neutral", confidence: 50, key_levels: [], order_blocks: [], fvg: [], entry_zones: [], risk_notes: [] }; }

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "footprint") {
      // Fetch aggregated trades for a symbol and build footprint (order flow) data
      const symbol = (url.searchParams.get("symbol") || "BTCUSDT").replace("USDT", "").toUpperCase();
      const binanceSymbol = `${symbol}USDT`;
      const tf = url.searchParams.get("timeframe") || "15";
      const bnInterval = BINANCE_INTERVALS[tf] || "15m";
      const candleCount = parseInt(url.searchParams.get("candles") || "12", 10);

      try {
        // Get klines to know candle boundaries
        const klUrl = `${BINANCE_API}/klines?symbol=${binanceSymbol}&interval=${bnInterval}&limit=${candleCount}`;
        const klResp = await fetch(klUrl, { headers: { Accept: "application/json" } });
        if (!klResp.ok) throw new Error(`Binance klines failed: ${klResp.status}`);
        const klRaw = (await klResp.json()) as unknown[][];

        const candles = klRaw.map((r) => ({
          openTime: r[0] as number,
          openTimeStr: new Date(r[0] as number).toISOString(),
          open: parseFloat(r[1] as string),
          high: parseFloat(r[2] as string),
          low: parseFloat(r[3] as string),
          close: parseFloat(r[4] as string),
          volume: parseFloat(r[5] as string),
          closeTime: r[6] as number,
        }));

        if (candles.length === 0) {
          return new Response(JSON.stringify({ footprint: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch aggTrades covering the time range of these candles
        const startTime = candles[0].openTime;
        const endTime = candles[candles.length - 1].closeTime;
        const aggUrl = `${BINANCE_API}/aggTrades?symbol=${binanceSymbol}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
        const aggResp = await fetch(aggUrl, { headers: { Accept: "application/json" } });
        if (!aggResp.ok) throw new Error(`Binance aggTrades failed: ${aggResp.status}`);
        const aggRaw = await aggResp.json() as {
          a: number; p: string; q: string; T: number; m: boolean;
        }[];

        // Group trades into candles by timestamp
        const footprint = candles.map((c) => {
          const tradesInCandle = aggRaw.filter((t) => t.T >= c.openTime && t.T <= c.closeTime);
          if (tradesInCandle.length === 0) {
            return {
              time: c.openTimeStr,
              open: c.open, high: c.high, low: c.low, close: c.close,
              totalVolume: c.volume, buyVolume: 0, sellVolume: 0,
              delta: 0, cumulativeDelta: 0,
              pocPrice: c.close, pocVolume: 0,
              levels: [], imbalances: [], tradeCount: 0,
            };
          }

          // Determine price bucket size (round to meaningful precision)
          const range = c.high - c.low;
          const tickSize = range > 0 ? range / 20 : c.close * 0.0001;
          const bucketSize = Math.max(tickSize, c.close * 0.00005);

          const levelMap = new Map<number, { buyVol: number; sellVol: number }>();
          let buyVol = 0, sellVol = 0;

          for (const t of tradesInCandle) {
            const price = parseFloat(t.p);
            const qty = parseFloat(t.q);
            // m=true means buyer is the market maker (aggressive seller), m=false means aggressive buyer
            const isBuy = !t.m;
            const bucket = Math.round(price / bucketSize) * bucketSize;

            let lvl = levelMap.get(bucket);
            if (!lvl) {
              lvl = { buyVol: 0, sellVol: 0 };
              levelMap.set(bucket, lvl);
            }
            if (isBuy) {
              lvl.buyVol += qty;
              buyVol += qty;
            } else {
              lvl.sellVol += qty;
              sellVol += qty;
            }
          }

          const delta = buyVol - sellVol;
          let cumDelta = 0;

          // Build sorted levels (high to low)
          const levels = Array.from(levelMap.entries())
            .map(([price, vol]) => ({
              price,
              buyVolume: vol.buyVol,
              sellVolume: vol.sellVol,
              total: vol.buyVol + vol.sellVol,
              delta: vol.buyVol - vol.sellVol,
            }))
            .sort((a, b) => b.price - a.price);

          // Cumulative delta from bottom up
          for (let i = levels.length - 1; i >= 0; i--) {
            cumDelta += levels[i].delta;
            levels[i].cumulativeDelta = cumDelta;
          }

          // POC = level with highest total volume
          let pocPrice = c.close, pocVolume = 0;
          for (const l of levels) {
            if (l.total > pocVolume) {
              pocVolume = l.total;
              pocPrice = l.price;
            }
          }

          // Detect imbalances (3:1 ratio on one side)
          const imbalances = levels.filter((l) => {
            const ratio = l.buyVolume > 0 && l.sellVolume > 0
              ? Math.max(l.buyVolume / l.sellVolume, l.sellVolume / l.buyVolume)
              : 0;
            return ratio >= 3 && l.total > pocVolume * 0.15;
          }).map((l) => ({
            price: l.price,
            direction: l.buyVolume > l.sellVolume ? "buy" : "sell",
          }));

          return {
            time: c.openTimeStr,
            open: c.open, high: c.high, low: c.low, close: c.close,
            totalVolume: buyVol + sellVol,
            buyVolume: buyVol,
            sellVolume: sellVol,
            delta,
            cumulativeDelta: cumDelta,
            pocPrice,
            pocVolume,
            levels,
            imbalances,
            tradeCount: tradesInCandle.length,
          };
        });

        // Add running cumulative delta across candles
        let runningDelta = 0;
        for (const f of footprint) {
          runningDelta += f.delta;
          f.cumulativeDelta = runningDelta;
        }

        return new Response(JSON.stringify({ footprint }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (fpErr) {
        return new Response(
          JSON.stringify({ error: fpErr instanceof Error ? fpErr.message : "Footprint fetch failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (action === "economic-calendar") {
      try {
        const events = await fetchEconomicCalendar();
        return new Response(JSON.stringify({ events }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (calErr) {
        return new Response(
          JSON.stringify({ error: calErr instanceof Error ? calErr.message : "Calendar fetch failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
