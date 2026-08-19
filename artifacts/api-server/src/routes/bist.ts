import { Router } from "express";
import YahooFinance from "yahoo-finance2";

const router = Router();
const yf = new YahooFinance();

type ChartQuote = {
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
};

const numberOrZero = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

async function chartFallbackQuote(symbol: string): Promise<ChartQuote | null> {
  try {
    const result = await yf.chart(symbol, {
      period1: new Date(Date.now() - 90 * 86400000),
      interval: "1d",
    });
    const quotes = (result.quotes ?? []).filter((quote) => numberOrZero(quote.close) > 0);
    const last = quotes.at(-1);
    const previous = quotes.at(-2) ?? last;
    if (!last) return null;

    const price = numberOrZero(last.close);
    const previousClose = numberOrZero(previous?.close) || price;
    const change = price - previousClose;
    const volumes = quotes.map((quote) => numberOrZero(quote.volume)).filter((volume) => volume > 0);
    const averageVolume = volumes.length
      ? volumes.reduce((sum, volume) => sum + volume, 0) / volumes.length
      : 0;

    return {
      symbol: symbol.replace(".IS", ""),
      shortName: symbol.replace(".IS", ""),
      regularMarketPrice: price,
      regularMarketChangePercent: previousClose ? (change / previousClose) * 100 : 0,
      regularMarketChange: change,
      regularMarketVolume: numberOrZero(last.volume),
      regularMarketPreviousClose: previousClose,
      regularMarketOpen: numberOrZero(last.open),
      regularMarketDayHigh: numberOrZero(last.high),
      regularMarketDayLow: numberOrZero(last.low),
      fiftyTwoWeekHigh: Math.max(...quotes.map((quote) => numberOrZero(quote.high)), price),
      fiftyTwoWeekLow: Math.min(...quotes.map((quote) => numberOrZero(quote.low)).filter((low) => low > 0), price),
      marketCap: 0,
      averageDailyVolume3Month: averageVolume,
    };
  } catch {
    return null;
  }
}

async function quoteWithFallback(symbol: string) {
  try {
    const quote = await yf.quote(symbol, {}, { validateResult: false });
    if (quote) return Array.isArray(quote) ? quote[0] ?? null : quote;
  } catch {
    // Yahoo quote endpoint may return 401; use chart data below.
  }
  return chartFallbackQuote(symbol);
}

router.get("/bist/quotes", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols || typeof symbols !== "string") {
      res.status(400).json({ error: "symbols required" });
      return;
    }
    const symbolList = symbols
      .split(",")
      .map((s) => `${s.trim().toUpperCase()}.IS`);

    const results = await Promise.all(symbolList.map(quoteWithFallback));
    const normalized = results
      .filter((quote): quote is NonNullable<typeof quote> => quote != null)
      .map((quote) => ({
        ...quote,
        symbol: (quote.symbol ?? "").replace(".IS", ""),
      }));

    res.json({ quoteResponse: { result: normalized, error: null } });
  } catch (err) {
    res.status(502).json({ error: "upstream error", detail: String(err) });
  }
});

type YfInterval = "5m" | "15m" | "60m" | "1h" | "1d" | "1wk" | "1mo";

const RANGE_CONFIG: Record<string, { days: number; interval: YfInterval }> = {
  "1d":  { days: 1,     interval: "5m"  },
  "5d":  { days: 5,     interval: "1h"  },
  "1mo": { days: 30,    interval: "1d"  },
  "3mo": { days: 90,    interval: "1d"  },
  "6mo": { days: 180,   interval: "1d"  },
  "1y":  { days: 365,   interval: "1d"  },
  "5y":  { days: 365*5, interval: "1wk" },
};

const ALLOWED_INTRADAY_INTERVALS: YfInterval[] = ["5m", "15m", "60m"];

router.get("/bist/macro", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols || typeof symbols !== "string") {
      res.status(400).json({ error: "symbols required" });
      return;
    }
    const symbolList = symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    const results = await Promise.all(symbolList.map(quoteWithFallback));
    const normalized = results
      .filter((quote): quote is NonNullable<typeof quote> => quote != null)
      .map((quote) => ({
        ...quote,
        symbol: String(quote.symbol ?? "").toUpperCase(),
      }));
    res.json({ quoteResponse: { result: normalized, error: null } });
  } catch (err) {
    res.status(502).json({ error: "macro upstream error", detail: String(err) });
  }
});

router.get("/bist/news", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" && req.query.q.trim()
      ? req.query.q.trim()
      : "Borsa Istanbul";
    const requestedCount = Number(req.query.count ?? 8);
    const count = Number.isFinite(requestedCount) ? Math.min(Math.max(Math.floor(requestedCount), 1), 12) : 8;
    const searchResult = await (yf as any).search(query, { newsCount: count, quotesCount: 0 });
    const news = Array.isArray(searchResult?.news) ? searchResult.news.slice(0, count).map((item: any) => ({
      title: String(item.title ?? ""),
      publisher: String(item.publisher ?? ""),
      link: typeof item.link === "string" ? item.link : "",
      providerPublishTime: Number(item.providerPublishTime ?? 0),
      type: String(item.type ?? "NEWS"),
    })).filter((item: { title: string }) => item.title.length > 0) : [];
    res.json({ news });
  } catch (err) {
    res.status(502).json({ error: "news upstream error", detail: String(err) });
  }
});

router.get("/bist/chart/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const range = (req.query.range as string) || "3mo";
    const cfg = RANGE_CONFIG[range] ?? RANGE_CONFIG["3mo"];
    const period1 = new Date(Date.now() - cfg.days * 86400000);

    const requestedInterval = req.query.interval as string | undefined;
    const interval =
      range === "1d" && requestedInterval && ALLOWED_INTRADAY_INTERVALS.includes(requestedInterval as YfInterval)
        ? (requestedInterval as YfInterval)
        : cfg.interval;

    const result = await yf.chart(`${symbol.toUpperCase()}.IS`, {
      period1,
      interval,
    });

    const quotes = result.quotes ?? [];
    const timestamps = quotes.map((q) =>
      Math.floor(new Date(q.date).getTime() / 1000)
    );
    const closes  = quotes.map((q) => q.close  ?? 0);
    const opens   = quotes.map((q) => q.open   ?? 0);
    const highs   = quotes.map((q) => q.high   ?? 0);
    const lows    = quotes.map((q) => q.low    ?? 0);
    const volumes = quotes.map((q) => q.volume ?? 0);

    res.json({
      chart: {
        result: [{
          timestamp: timestamps,
          indicators: {
            quote: [{ close: closes, open: opens, high: highs, low: lows, volume: volumes }],
          },
        }],
        error: null,
      },
    });
  } catch (err) {
    res.status(502).json({ error: "upstream error", detail: String(err) });
  }
});

export default router;
