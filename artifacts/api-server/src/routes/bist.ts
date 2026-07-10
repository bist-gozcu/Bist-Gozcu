import { Router } from "express";
import YahooFinance from "yahoo-finance2";

const router = Router();
const yf = new YahooFinance();

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

    const CHUNK_SIZE = 20;
    const chunks: string[][] = [];
    for (let i = 0; i < symbolList.length; i += CHUNK_SIZE) {
      chunks.push(symbolList.slice(i, i + CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const result = await yf.quote(chunk, {}, { validateResult: false });
          return Array.isArray(result) ? result : [result];
        } catch {
          const perSymbol = await Promise.all(
            chunk.map(async (sym) => {
              try {
                const r = await yf.quote(sym, {}, { validateResult: false });
                return r;
              } catch {
                return null;
              }
            })
          );
          return perSymbol.filter(Boolean);
        }
      })
    );

    const arr = chunkResults.flat();
    const normalized = arr
      .filter((q): q is NonNullable<typeof q> => q != null)
      .map((q) => ({
        ...q,
        symbol: (q.symbol ?? "").replace(".IS", ""),
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
