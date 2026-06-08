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

    const result = await yf.quote(symbolList);
    const arr = Array.isArray(result) ? result : [result];
    const normalized = arr.map((q) => ({
      ...q,
      symbol: (q.symbol ?? "").replace(".IS", ""),
    }));

    res.json({ quoteResponse: { result: normalized, error: null } });
  } catch (err) {
    res.status(502).json({ error: "upstream error", detail: String(err) });
  }
});

router.get("/bist/chart/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const { range = "3mo" } = req.query;
    const validRange = ["1mo", "3mo", "6mo", "1y"].includes(range as string)
      ? (range as string)
      : "3mo";
    const msMap: Record<string, number> = {
      "1mo": 30 * 86400000,
      "3mo": 90 * 86400000,
      "6mo": 180 * 86400000,
      "1y": 365 * 86400000,
    };
    const period1 = new Date(Date.now() - (msMap[validRange] ?? msMap["3mo"]));

    const result = await yf.chart(`${symbol.toUpperCase()}.IS`, {
      period1,
      interval: "1d",
    });

    const quotes = result.quotes ?? [];
    const timestamps = quotes.map((q) =>
      Math.floor(new Date(q.date).getTime() / 1000)
    );
    const closes = quotes.map((q) => q.close ?? 0);
    const opens = quotes.map((q) => q.open ?? 0);
    const highs = quotes.map((q) => q.high ?? 0);
    const lows = quotes.map((q) => q.low ?? 0);
    const volumes = quotes.map((q) => q.volume ?? 0);

    res.json({
      chart: {
        result: [
          {
            timestamp: timestamps,
            indicators: {
              quote: [
                {
                  close: closes,
                  open: opens,
                  high: highs,
                  low: lows,
                  volume: volumes,
                },
              ],
            },
          },
        ],
        error: null,
      },
    });
  } catch (err) {
    res.status(502).json({ error: "upstream error", detail: String(err) });
  }
});

export default router;
