---
name: BIST Gözcü quote fetching scope
description: Why search/portfolio stocks outside BIST30 showed no price data, and how batch quote fetching is chunked.
---

The stock quotes context (`StockContext`) originally only fetched prices for `BIST30`, not the full `ALL_BIST_STOCKS` list used by the search screen. Any stock outside the top-30 (e.g. newly added smaller-cap tickers) rendered with no price data, even though its symbol existed in the stock list and the Yahoo Finance API route worked fine.

**Why:** the search/browse UI draws from `ALL_BIST_STOCKS`, but only quotes present in the `StockContext` map get displayed — a scope mismatch, not an API failure.

**How to apply:** when adding new BIST tickers to `constants/bistStocks.ts`, make sure the quote-fetching context also covers them (not just BIST30). Fetch in chunks (~20-25 symbols per request) both client-side and in the API server's `yf.quote()` call — Yahoo Finance batch quote calls can throw for the whole batch if one symbol is invalid/delisted, so chunk + per-symbol fallback + `validateResult: false` keeps one bad ticker from blanking out all others.
