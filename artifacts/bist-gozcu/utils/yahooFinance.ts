export interface QuoteData {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketChange: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  averageDailyVolume3Month: number;
  /** Kaynağın fiyatı son güncellediği Unix zamanı; yoksa null. */
  marketTimestamp: number | null;
  /** Quote’un uygulama tarafından alındığı Unix zamanı. */
  fetchedAt: number;
  /** Kaynakta bildirilen gecikme saniyesi; Yahoo için 15 dakika gibi. */
  delayedBySeconds: number | null;
  /** Quote yanıtında belirtilen piyasa durumu. */
  marketState: string | null;
  /** Veri tazeliği sınıfı. */
  freshness: DataFreshness;
  /** Verinin hangi kaynaktan geldiği. */
  dataSource: string;
}

export type DataFreshness =
  | "fresh"
  | "slightly_delayed"
  | "stale"
  | "unknown"
  | "closed_reference";

/** Unix saniyesi veya ISO tarihini güvenli biçimde Unix saniyesine çevirir. */
export function parseMarketTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 1_000_000_000_000 ? value / 1000 : value;
  }
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1_000_000_000_000 ? numeric / 1000 : numeric;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed / 1000 : null;
}

export interface ChartResult {
  symbol: string;
  timestamps: number[];
  closes: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

export type ChartRange = "1d" | "5d" | "1mo" | "3mo" | "1y" | "5y";

export interface MarketNews {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  type: string;
}

export interface StockFundamentals {
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  enterpriseToEbitda: number | null;
  bookValue: number | null;
  returnOnEquity: number | null;
  profitMargins: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  targetMeanPrice: number | null;
  recommendationMean: number | null;
  analystCount: number | null;
  asOf: string | null;
}

export interface StockOverview {
  symbol: string;
  quote?: QuoteData;
  fundamentals: StockFundamentals;
  news: MarketNews[];
  source: string;
}
export type IntradayInterval = "5m" | "10m" | "15m" | "60m";

import { Platform } from "react-native";

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "tr-TR,tr;q=0.9",
};

const RANGE_INTERVAL: Record<ChartRange, string> = {
  // Uygulamadaki etiketler: 1G=15dk, 1H=1saat, 1A=4saat,
  // 3A=1gün, 1Y=1hafta, 5Y=1ay.
  "1d": "15m",
  "5d": "60m",
  "1mo": "1h",
  "3mo": "1d",
  "1y": "1wk",
  "5y": "1mo",
};

const QUOTE_TIMEOUT_MS = 8_000;
const QUOTE_BATCH_DEADLINE_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = QUOTE_TIMEOUT_MS,
): Promise<Response> {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const requestInit: RequestInit = controller
    ? { ...init, signal: controller.signal }
    : init;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new Error(`İstek zaman aşımına uğradı: ${url}`));
    }, timeoutMs);
  });
  try {
    // Promise.race, Android fetch abort’u gecikse bile üst katmanın beklemesini engeller.
    return await Promise.race([fetch(url, requestInit), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const PERMANENT_PROXY_BASE = "https://bist-gozcu--careki73.replit.app/api";

function getProxyBase(): string {
  const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  // Android’da EAS ortam değişkeni boş veya eski olsa bile kalıcı proxy kesin kullanılır.
  if (
    !configuredDomain ||
    configuredDomain === "bist-gozcu--careki73.replit.app"
  ) {
    return PERMANENT_PROXY_BASE;
  }
  return `https://${configuredDomain}/api`;
}

let cachedCrumb: string | null = null;
let crumbFetchTime = 0;

async function getCrumb(): Promise<string | null> {
  if (cachedCrumb && Date.now() - crumbFetchTime < 3600000) return cachedCrumb;
  try {
    const res = await fetchWithTimeout(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      {
        headers: YF_HEADERS,
      },
    );
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes("<") && text.length < 30) {
        cachedCrumb = text.trim();
        crumbFetchTime = Date.now();
        return cachedCrumb;
      }
    }
  } catch {}
  return null;
}

type YahooChartQuote = {
  chart?: {
    result?: Array<{
      meta?: Record<string, unknown>;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

async function fetchQuoteFromChart(
  symbol: string,
  timeoutMs = QUOTE_TIMEOUT_MS,
): Promise<QuoteData | null> {
  try {
    const yahooSymbol = `${symbol.replace(".IS", "").toUpperCase()}.IS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=3mo&includePrePost=false`;
    // Android OkHttp bazı sürümlerde tarayıcı User-Agent başlığını reddedebiliyor.
    const res = await fetchWithTimeout(url, undefined, timeoutMs);
    if (!res.ok) return null;

    const json = (await res.json()) as YahooChartQuote;
    const result = json.chart?.result?.[0];
    const meta = result?.meta ?? {};
    const quote = result?.indicators?.quote?.[0] ?? {};
    const closes = quote.close ?? [];
    const opens = quote.open ?? [];
    const highs = quote.high ?? [];
    const lows = quote.low ?? [];
    const volumes = quote.volume ?? [];
    const validIndexes = closes
      .map((close, index) =>
        typeof close === "number" && close > 0 ? index : -1,
      )
      .filter((index) => index >= 0);
    const lastIndex = validIndexes.at(-1);
    if (lastIndex == null) return null;

    const price =
      asNumber(meta.regularMarketPrice) || asNumber(closes[lastIndex]);
    const previousClose =
      asNumber(meta.chartPreviousClose) ||
      asNumber(closes[validIndexes.at(-2) ?? lastIndex]);
    const change = price - previousClose;
    const averageVolume = volumes
      .map(asNumber)
      .filter((volume) => volume > 0)
      .reduce((sum, volume, _, values) => sum + volume / values.length, 0);

    return {
      symbol: symbol.replace(".IS", "").toUpperCase(),
      shortName: String(meta.shortName ?? meta.longName ?? symbol),
      regularMarketPrice: price,
      regularMarketChangePercent: previousClose
        ? (change / previousClose) * 100
        : 0,
      regularMarketChange: change,
      regularMarketVolume:
        asNumber(meta.regularMarketVolume) || asNumber(volumes[lastIndex]),
      regularMarketPreviousClose: previousClose,
      regularMarketOpen: asNumber(opens[lastIndex]),
      regularMarketDayHigh:
        asNumber(meta.regularMarketDayHigh) || asNumber(highs[lastIndex]),
      regularMarketDayLow:
        asNumber(meta.regularMarketDayLow) || asNumber(lows[lastIndex]),
      fiftyTwoWeekHigh: asNumber(meta.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: asNumber(meta.fiftyTwoWeekLow),
      marketCap: asNumber(meta.marketCap),
      // Quote endpoint’i kapalı olduğunda 5 günlük chart hacmi güvenli yaklaşık değerdir.
      averageDailyVolume3Month: averageVolume,
      ...normalizeQuoteMetadata(meta, "Yahoo chart fallback"),
    };
  } catch {
    return null;
  }
}

async function fetchQuotesFromChart(symbols: string[]): Promise<QuoteData[]> {
  const results: QuoteData[] = [];
  const concurrency = 4;
  const deadline = Date.now() + QUOTE_BATCH_DEADLINE_MS;
  for (
    let i = 0;
    i < symbols.length && Date.now() < deadline;
    i += concurrency
  ) {
    const remaining = deadline - Date.now();
    const batch = await Promise.all(
      symbols
        .slice(i, i + concurrency)
        .map((symbol) =>
          fetchQuoteFromChart(symbol, Math.min(QUOTE_TIMEOUT_MS, remaining)),
        ),
    );
    results.push(
      ...batch.filter((quote): quote is QuoteData => quote !== null),
    );
  }
  return results;
}

const PROXY_CHUNK_SIZE = 24;
const PROXY_TIMEOUT_MS = 20_000;
const PROXY_RETRIES = 2;

const expectedIntervalSeconds: Record<string, number> = {
  "5m": 5 * 60,
  "15m": 15 * 60,
  "60m": 60 * 60,
  "1h": 60 * 60,
  "1d": 24 * 60 * 60,
  "1wk": 7 * 24 * 60 * 60,
  "1mo": 30 * 24 * 60 * 60,
};

export function classifyDataFreshness(
  marketTimestamp: number | null,
  fetchedAt = Date.now(),
  marketOpen = isBistOpen(),
): DataFreshness {
  if (!marketTimestamp || !Number.isFinite(marketTimestamp)) return "unknown";
  if (!marketOpen) return "closed_reference";
  const ageMinutes = Math.max(0, fetchedAt - marketTimestamp * 1000) / 60000;
  if (ageMinutes <= 10) return "fresh";
  if (ageMinutes <= 30) return "slightly_delayed";
  if (ageMinutes <= 120) return "stale";
  return "unknown";
}

export function getFreshnessLabel(freshness: DataFreshness): string {
  switch (freshness) {
    case "fresh":
      return "Kaynak zamanı yeni";
    case "slightly_delayed":
      return "Kısa gecikmeli";
    case "stale":
      return "Eski veri";
    case "closed_reference":
      return "Son kapanış referansı";
    default:
      return "Zamanı doğrulanamadı";
  }
}

export function formatMarketTimestamp(timestamp: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "zaman bilinmiyor";
  return new Date(timestamp * 1000).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFreshnessWarning(freshness: DataFreshness): string | null {
  switch (freshness) {
    case "fresh":
      return "Kaynak zamanı yeni; gerçek zamanlı olduğu doğrulanmadı.";
    case "slightly_delayed":
      return "Veri kısa gecikmeli; yeni telefon bildirimi kapalı.";
    case "stale":
      return "Veri eski; yeni radar adayı ve bildirim üretilmedi.";
    case "closed_reference":
      return "Piyasa kapalı; analiz son tamamlanmış kapanışa göre.";
    default:
      return "Veri zamanı doğrulanamadı; karar için yeterli güncel veri yok.";
  }
}

function normalizeQuoteMetadata(
  quote: Record<string, unknown>,
  dataSource: string,
): Pick<
  QuoteData,
  | "marketTimestamp"
  | "fetchedAt"
  | "delayedBySeconds"
  | "marketState"
  | "freshness"
  | "dataSource"
> {
  const fetchedAt = Date.now();
  const marketTimestamp = parseMarketTimestamp(quote.regularMarketTime);
  const rawDelay = Number(quote.exchangeDataDelayedBy);
  const delayedBySeconds =
    Number.isFinite(rawDelay) && rawDelay >= 0 ? rawDelay : null;
  const marketState =
    typeof quote.marketState === "string" ? quote.marketState : null;
  const quoteSourceName =
    typeof quote.quoteSourceName === "string" ? quote.quoteSourceName : null;
  const baseFreshness = classifyDataFreshness(marketTimestamp, fetchedAt);
  const knownDelayed =
    Boolean(quoteSourceName?.toLowerCase().includes("delayed")) ||
    (delayedBySeconds != null && delayedBySeconds > 0);
  const freshness: DataFreshness =
    knownDelayed && baseFreshness === "fresh"
      ? "slightly_delayed"
      : baseFreshness;
  return {
    marketTimestamp,
    fetchedAt,
    delayedBySeconds,
    marketState,
    freshness,
    dataSource: quoteSourceName
      ? `${dataSource} · ${quoteSourceName}`
      : dataSource,
  };
}

function normalizeProxyResults(payload: unknown): QuoteData[] {
  const root = payload as {
    quoteResponse?: { result?: Array<Record<string, unknown>> };
  };
  const rawResults = Array.isArray(root?.quoteResponse?.result)
    ? root.quoteResponse.result
    : [];

  return rawResults
    .map((q) => {
      const rawSymbol = typeof q.symbol === "string" ? q.symbol : "";
      const symbol = rawSymbol.replace(/\.IS$/i, "").toUpperCase();
      return {
        ...q,
        symbol,
        regularMarketPrice: Number(q.regularMarketPrice) || 0,
        regularMarketChangePercent: Number(q.regularMarketChangePercent) || 0,
        regularMarketChange: Number(q.regularMarketChange) || 0,
        regularMarketVolume: Number(q.regularMarketVolume) || 0,
        regularMarketPreviousClose: Number(q.regularMarketPreviousClose) || 0,
        regularMarketOpen: Number(q.regularMarketOpen) || 0,
        regularMarketDayHigh: Number(q.regularMarketDayHigh) || 0,
        regularMarketDayLow: Number(q.regularMarketDayLow) || 0,
        fiftyTwoWeekHigh: Number(q.fiftyTwoWeekHigh) || 0,
        fiftyTwoWeekLow: Number(q.fiftyTwoWeekLow) || 0,
        marketCap: Number(q.marketCap) || 0,
        averageDailyVolume3Month: Number(q.averageDailyVolume3Month) || 0,
        ...normalizeQuoteMetadata(q, "BIST Gözcü proxy / Yahoo quote"),
      } as QuoteData;
    })
    .filter((q) => q.symbol.length > 0 && q.regularMarketPrice > 0);
}

async function fetchProxyChunk(
  proxyBase: string,
  symbols: string[],
): Promise<QuoteData[]> {
  const url = `${proxyBase}/bist/quotes?symbols=${symbols.join(",")}`;
  for (let attempt = 0; attempt < PROXY_RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, undefined, PROXY_TIMEOUT_MS);
      if (!res.ok) continue;
      const results = normalizeProxyResults(await res.json());
      if (results.length > 0) return results;
    } catch {
      // Replit free deployment may need one retry after waking from sleep.
    }
  }
  return [];
}

async function fetchMacroQuotesDirect(symbols: string[]): Promise<QuoteData[]> {
  const hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      for (const host of hosts) {
        try {
          const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`;
          const res = await fetchWithTimeout(
            url,
            { headers: YF_HEADERS },
            12_000,
          );
          if (!res.ok) continue;
          const json = (await res.json()) as YahooChartQuote;
          const result = json.chart?.result?.[0];
          const meta = result?.meta ?? {};
          const quote = result?.indicators?.quote?.[0] ?? {};
          const closes = quote.close ?? [];
          const validIndexes = closes
            .map((close, index) =>
              typeof close === "number" && close > 0 ? index : -1,
            )
            .filter((index) => index >= 0);
          const lastIndex = validIndexes.at(-1);
          if (lastIndex == null) continue;
          const price =
            asNumber(meta.regularMarketPrice) || asNumber(closes[lastIndex]);
          const previousClose =
            asNumber(meta.chartPreviousClose) ||
            asNumber(closes[validIndexes.at(-2) ?? lastIndex]);
          if (price <= 0) continue;
          const volumeValues = (quote.volume ?? [])
            .map(asNumber)
            .filter((volume) => volume > 0);
          const averageVolume = volumeValues.length
            ? volumeValues.reduce(
                (sum, volume) => sum + volume / volumeValues.length,
                0,
              )
            : 0;
          const change = price - previousClose;
          return {
            symbol: symbol.replace(/\.IS$/i, "").toUpperCase(),
            shortName: String(meta.shortName ?? meta.longName ?? symbol),
            regularMarketPrice: price,
            regularMarketChangePercent: previousClose
              ? (change / previousClose) * 100
              : 0,
            regularMarketChange: change,
            regularMarketVolume: asNumber(meta.regularMarketVolume),
            regularMarketPreviousClose: previousClose,
            regularMarketOpen: asNumber(meta.regularMarketOpen),
            regularMarketDayHigh: asNumber(meta.regularMarketDayHigh),
            regularMarketDayLow: asNumber(meta.regularMarketDayLow),
            fiftyTwoWeekHigh: asNumber(meta.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: asNumber(meta.fiftyTwoWeekLow),
            marketCap: asNumber(meta.marketCap),
            averageDailyVolume3Month: averageVolume,
            ...normalizeQuoteMetadata(meta, "Yahoo macro chart fallback"),
          } as QuoteData;
        } catch {
          // Bir Yahoo hostu kota veya ağ hatası verirse diğer host denenir.
        }
      }
      return null;
    }),
  );
  return results.filter((quote): quote is QuoteData => quote !== null);
}

export async function fetchMacroQuotes(
  symbols: string[],
): Promise<QuoteData[]> {
  const proxyBase = getProxyBase();
  try {
    const url = `${proxyBase}/bist/macro?symbols=${symbols.map(encodeURIComponent).join(",")}`;
    const res = await fetchWithTimeout(url, undefined, PROXY_TIMEOUT_MS);
    if (res.ok) {
      const proxyResults = normalizeProxyResults(await res.json());
      if (proxyResults.length > 0) return proxyResults;
    }
  } catch {
    // Eski proxy sürümlerinde makro rotası olmayabilir; doğrudan chart fallback’i denenir.
  }
  return fetchMacroQuotesDirect(symbols);
}

const CRYPTO_PAIRS: Record<string, { symbol: string; shortName: string }> = {
  BTCUSDT: { symbol: "BTC-USD", shortName: "Bitcoin / USD" },
  ETHUSDT: { symbol: "ETH-USD", shortName: "Ethereum / USD" },
};

function toCryptoQuote(
  pair: { symbol: string; shortName: string },
  lastPrice: number,
  change: number,
  changePercent: number,
  previousClose: number,
  volume: number,
  high: number,
  low: number,
): QuoteData {
  return {
    symbol: pair.symbol,
    shortName: pair.shortName,
    regularMarketPrice: lastPrice,
    regularMarketChangePercent: changePercent,
    regularMarketChange: change,
    regularMarketVolume: volume,
    regularMarketPreviousClose: previousClose,
    regularMarketOpen: previousClose,
    regularMarketDayHigh: high,
    regularMarketDayLow: low,
    fiftyTwoWeekHigh: 0,
    fiftyTwoWeekLow: 0,
    marketCap: 0,
    averageDailyVolume3Month: volume,
    marketTimestamp: null,
    fetchedAt: Date.now(),
    delayedBySeconds: 0,
    marketState: "OPEN",
    freshness: "fresh",
    dataSource: "Binance/CoinGecko kripto quote",
  };
}

export async function fetchCryptoQuotes(): Promise<QuoteData[]> {
  try {
    const url =
      "https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D";
    const res = await fetchWithTimeout(url, undefined, 10_000);
    if (res.ok) {
      const payload = (await res.json()) as Array<Record<string, unknown>>;
      const quotes = payload.flatMap((item) => {
        const pair = CRYPTO_PAIRS[String(item.symbol ?? "").toUpperCase()];
        const lastPrice = Number(item.lastPrice);
        const change = Number(item.priceChange);
        const changePercent = Number(item.priceChangePercent);
        const previousClose = Number(item.prevClosePrice);
        if (
          !pair ||
          !Number.isFinite(lastPrice) ||
          lastPrice <= 0 ||
          !Number.isFinite(previousClose) ||
          previousClose <= 0
        )
          return [];
        return [
          toCryptoQuote(
            pair,
            lastPrice,
            Number.isFinite(change) ? change : lastPrice - previousClose,
            Number.isFinite(changePercent)
              ? changePercent
              : ((lastPrice - previousClose) / previousClose) * 100,
            previousClose,
            Number.isFinite(Number(item.volume)) ? Number(item.volume) : 0,
            Number(item.highPrice) || lastPrice,
            Number(item.lowPrice) || lastPrice,
          ),
        ];
      });
      if (quotes.length > 0) return quotes;
    }
  } catch {
    // Binance erişimi yoksa CoinGecko yedek kaynağı denenir.
  }

  try {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true";
    const res = await fetchWithTimeout(url, undefined, 10_000);
    if (!res.ok) return [];
    const payload = (await res.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;
    return (
      [
        ["bitcoin", { symbol: "BTC-USD", shortName: "Bitcoin / USD" }],
        ["ethereum", { symbol: "ETH-USD", shortName: "Ethereum / USD" }],
      ] as const
    ).flatMap(([id, pair]) => {
      const lastPrice = Number(payload[id]?.usd);
      const changePercent = Number(payload[id]?.usd_24h_change);
      if (!Number.isFinite(lastPrice) || lastPrice <= 0) return [];
      const previousClose = Number.isFinite(changePercent)
        ? lastPrice / (1 + changePercent / 100)
        : lastPrice;
      return [
        toCryptoQuote(
          pair,
          lastPrice,
          lastPrice - previousClose,
          Number.isFinite(changePercent) ? changePercent : 0,
          previousClose,
          0,
          lastPrice,
          lastPrice,
        ),
      ];
    });
  } catch {
    return [];
  }
}

export async function fetchStockOverview(
  symbol: string,
): Promise<StockOverview | null> {
  const normalizedSymbol = symbol.trim().toUpperCase().replace(/\.IS$/i, "");
  const proxyBase = getProxyBase();
  const emptyFundamentals: StockFundamentals = {
    trailingPE: null,
    forwardPE: null,
    priceToBook: null,
    priceToSales: null,
    enterpriseToEbitda: null,
    bookValue: null,
    returnOnEquity: null,
    profitMargins: null,
    revenueGrowth: null,
    earningsGrowth: null,
    debtToEquity: null,
    dividendYield: null,
    targetMeanPrice: null,
    recommendationMean: null,
    analystCount: null,
    asOf: null,
  };

  try {
    const url = `${proxyBase}/bist/stock/${encodeURIComponent(normalizedSymbol)}/overview`;
    const res = await fetchWithTimeout(url, undefined, PROXY_TIMEOUT_MS);
    if (res.ok) {
      const payload = (await res.json()) as Partial<StockOverview> & {
        quote?: Record<string, unknown>;
      };
      const normalizedQuote = payload.quote
        ? normalizeProxyResults({
            quoteResponse: { result: [payload.quote] },
          })[0]
        : undefined;
      return {
        symbol: String(payload.symbol ?? normalizedSymbol)
          .replace(/\.IS$/i, "")
          .toUpperCase(),
        quote: normalizedQuote,
        fundamentals: { ...emptyFundamentals, ...(payload.fundamentals ?? {}) },
        news: Array.isArray(payload.news) ? payload.news : [],
        source: String(payload.source ?? "BIST Gözcü proxy"),
      };
    }
  } catch {
    // Eski veya kota dolu proxy sürümlerinde aşağıdaki düşük maliyetli fallback denenir.
  }

  try {
    const [fallbackQuote, fallbackNews] = await Promise.all([
      fetchSingleQuote(normalizedSymbol),
      fetchMarketNews(normalizedSymbol, 3),
    ]);
    if (!fallbackQuote && fallbackNews.length === 0) return null;
    return {
      symbol: normalizedSymbol,
      quote: fallbackQuote ?? undefined,
      fundamentals: emptyFundamentals,
      news: fallbackNews,
      source: "Yahoo fiyat/haber fallback’i; temel oran verisi yok",
    };
  } catch {
    return null;
  }
}

export async function fetchMarketNews(
  query = "Borsa Istanbul",
  count = 8,
): Promise<MarketNews[]> {
  const proxyBase = getProxyBase();
  try {
    const url = `${proxyBase}/bist/news?q=${encodeURIComponent(query)}&count=${Math.min(Math.max(count, 1), 12)}`;
    const res = await fetchWithTimeout(url, undefined, PROXY_TIMEOUT_MS);
    if (!res.ok) return [];
    const payload = (await res.json()) as { news?: MarketNews[] };
    return Array.isArray(payload.news) ? payload.news : [];
  } catch {
    return [];
  }
}

export async function fetchBatchQuotes(
  symbols: string[],
): Promise<QuoteData[]> {
  const proxyBase = getProxyBase();

  if (proxyBase) {
    const proxyResults: QuoteData[] = [];
    for (let i = 0; i < symbols.length; i += PROXY_CHUNK_SIZE) {
      const chunkResults = await fetchProxyChunk(
        proxyBase,
        symbols.slice(i, i + PROXY_CHUNK_SIZE),
      );
      proxyResults.push(...chunkResults);
    }
    if (proxyResults.length > 0) return proxyResults;
  }

  // Yahoo’nun v7 quote endpoint’i bazı ağlarda 401 döndürüyor. Chart endpoint’i
  // mobil cihazlarda çalıştığı için son güvenli fallback olarak kullanılır.
  return fetchQuotesFromChart(symbols);
}

export async function fetchSingleQuote(
  symbol: string,
): Promise<QuoteData | null> {
  const normalized = symbol.replace(/\.IS$/i, "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,6}$/.test(normalized)) return null;
  const quotes = await fetchBatchQuotes([normalized]);
  return quotes.find((quote) => quote.symbol === normalized) ?? null;
}

function parseChartJson(json: unknown, sym: string): ChartResult | null {
  const chart = (
    json as Record<string, Record<string, Array<Record<string, unknown>>>>
  )?.chart?.result?.[0];
  if (!chart) return null;

  const timestamps: number[] = (chart.timestamp as number[]) ?? [];
  const quote =
    (
      chart.indicators as Record<
        string,
        Array<Record<string, (number | null)[]>>
      >
    )?.quote?.[0] ?? {};

  const clean = (arr: (number | null)[] | undefined): number[] =>
    (arr ?? []).map((v) =>
      v == null || isNaN(v as number) ? 0 : (v as number),
    );

  return {
    symbol: sym.replace(".IS", ""),
    timestamps,
    closes: clean(quote.close),
    opens: clean(quote.open),
    highs: clean(quote.high),
    lows: clean(quote.low),
    volumes: clean(quote.volume),
  };
}

function chartIntervalMatches(
  data: ChartResult,
  expectedInterval: string,
): boolean {
  const expected = expectedIntervalSeconds[expectedInterval];
  if (!expected || data.timestamps.length < 4) return true;
  const diffs = data.timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - data.timestamps[index])
    .filter((diff) => diff > 0)
    .sort((a, b) => a - b);
  if (diffs.length < 3) return true;
  const median = diffs[Math.floor(diffs.length / 2)];
  // Hafta sonu/tatil boşluklarını tolere ederken yanlış günlük/haftalık seriyi reddet.
  return median >= expected * 0.45 && median <= expected * 2.2;
}

function aggregateCandles(data: ChartResult, groupSize: number): ChartResult {
  if (groupSize <= 1) return data;
  const timestamps: number[] = [];
  const closes: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];

  for (let i = 0; i < data.closes.length; i += groupSize) {
    const end = Math.min(i + groupSize, data.closes.length);
    const slice = {
      c: data.closes.slice(i, end),
      o: data.opens.slice(i, end),
      h: data.highs.slice(i, end),
      l: data.lows.slice(i, end),
      v: data.volumes.slice(i, end),
    };
    const validIdx = slice.c
      .map((c, idx) => (c > 0 ? idx : -1))
      .filter((idx) => idx >= 0);
    if (validIdx.length === 0) continue;
    timestamps.push(data.timestamps[i]);
    opens.push(slice.o[validIdx[0]] || slice.c[validIdx[0]]);
    closes.push(slice.c[validIdx[validIdx.length - 1]]);
    highs.push(
      Math.max(...validIdx.map((idx) => slice.h[idx] || slice.c[idx])),
    );
    lows.push(
      Math.min(
        ...validIdx.map((idx) =>
          slice.l[idx] > 0 ? slice.l[idx] : slice.c[idx],
        ),
      ),
    );
    volumes.push(slice.v.reduce((s, v) => s + v, 0));
  }

  return {
    symbol: data.symbol,
    timestamps,
    closes,
    opens,
    highs,
    lows,
    volumes,
  };
}

export async function fetchChartData(
  symbol: string,
  range: ChartRange = "3mo",
  intradayInterval?: IntradayInterval,
): Promise<ChartResult | null> {
  const yahooInterval =
    range === "1d" && intradayInterval
      ? intradayInterval === "10m"
        ? "5m"
        : intradayInterval
      : RANGE_INTERVAL[range];
  const proxyBase = getProxyBase();

  const finish = (result: ChartResult | null): ChartResult | null => {
    if (!result) return null;
    if (range === "1mo" && yahooInterval === "1h") {
      // 1 aylık görünümde 1 saatlik gerçek mumları 4 saatlik mumlara birleştir.
      return aggregateCandles(result, 4);
    }
    if (range === "1d" && intradayInterval === "10m") {
      return aggregateCandles(result, 2);
    }
    return result;
  };

  if (proxyBase) {
    try {
      const url = `${proxyBase}/bist/chart/${symbol}?range=${range}&interval=${yahooInterval}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const result = parseChartJson(json, symbol);
        if (result && chartIntervalMatches(result, yahooInterval))
          return finish(result);
      }
    } catch {}
  }

  try {
    const v8url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}.IS?interval=${yahooInterval}&range=${range}&includePrePost=false`;
    const res = await fetchWithTimeout(v8url, { headers: YF_HEADERS });
    if (res.ok) {
      const json = await res.json();
      const result = parseChartJson(json, symbol);
      if (result && chartIntervalMatches(result, yahooInterval))
        return finish(result);
    }
  } catch {}

  try {
    const crumb = await getCrumb();
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : "";
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}.IS?interval=${yahooInterval}&range=${range}${crumbParam}`;
    const res = await fetchWithTimeout(url, { headers: YF_HEADERS });
    const json = await res.json();
    const result = parseChartJson(json, symbol);
    return result && chartIntervalMatches(result, yahooInterval)
      ? finish(result)
      : null;
  } catch {
    return null;
  }
}

export function isBistOpen(): boolean {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istanbul = new Date(utc + 3 * 3600000);
  const day = istanbul.getDay();
  const hour = istanbul.getHours();
  const min = istanbul.getMinutes();
  const t = hour * 100 + min;
  if (day === 0 || day === 6) return false;
  return t >= 1000 && t < 1800;
}

export function getMarketSession(): "pre" | "open" | "post" | "closed" {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istanbul = new Date(utc + 3 * 3600000);
  const day = istanbul.getDay();
  if (day === 0 || day === 6) return "closed";
  const hour = istanbul.getHours();
  const min = istanbul.getMinutes();
  const t = hour * 100 + min;
  if (t < 930) return "closed";
  if (t < 1000) return "pre";
  if (t < 1800) return "open";
  if (t < 1830) return "post";
  return "closed";
}
