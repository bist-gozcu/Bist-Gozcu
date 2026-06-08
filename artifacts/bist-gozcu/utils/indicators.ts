export function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

export function ema(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = NaN;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      const seed = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      result.push(seed);
    } else {
      const val = prices[i] * k + prev * (1 - k);
      prev = val;
      result.push(val);
    }
  }
  return result;
}

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(prices: number[], fast = 12, slow = 26, signal = 9): MACDResult {
  const ema12 = ema(prices, fast);
  const ema26 = ema(prices, slow);
  const macdLine = ema12.map((v, i) =>
    isNaN(v) || isNaN(ema26[i]) ? NaN : v - ema26[i]
  );
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalEma = ema(validMacd, signal);
  const signalLine: number[] = new Array(prices.length).fill(NaN);
  let si = 0;
  for (let i = 0; i < prices.length; i++) {
    if (!isNaN(macdLine[i])) {
      signalLine[i] = signalEma[si] ?? NaN;
      si++;
    }
  }
  const histogram = macdLine.map((v, i) =>
    isNaN(v) || isNaN(signalLine[i]) ? NaN : v - signalLine[i]
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

export function rsi(prices: number[], period = 14): number[] {
  const result: number[] = new Array(prices.length).fill(NaN);
  if (prices.length < period + 1) return result;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function bollingerBands(prices: number[], period = 20, stdDev = 2): BollingerBands {
  const middle = sma(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
      const sd = Math.sqrt(variance);
      upper.push(mean + stdDev * sd);
      lower.push(mean - stdDev * sd);
    }
  }
  return { upper, middle, lower };
}

export interface StochasticResult {
  k: number[];
  d: number[];
}

export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3
): StochasticResult {
  const k: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < kPeriod - 1) {
      k.push(NaN);
    } else {
      const sliceH = highs.slice(i - kPeriod + 1, i + 1);
      const sliceL = lows.slice(i - kPeriod + 1, i + 1);
      const highest = Math.max(...sliceH);
      const lowest = Math.min(...sliceL);
      const range = highest - lowest;
      k.push(range === 0 ? 50 : ((closes[i] - lowest) / range) * 100);
    }
  }
  const d = sma(k.filter((v) => !isNaN(v)), dPeriod);
  const dAligned: number[] = new Array(closes.length).fill(NaN);
  let di = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(k[i])) {
      dAligned[i] = d[di] ?? NaN;
      di++;
    }
  }
  return { k, d: dAligned };
}

export function moneyFlowIndex(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period = 14
): number[] {
  const typicalPrices = closes.map((c, i) => (c + highs[i] + lows[i]) / 3);
  const rawMoneyFlow = typicalPrices.map((tp, i) => tp * volumes[i]);
  const result: number[] = new Array(closes.length).fill(NaN);
  for (let i = period; i < closes.length; i++) {
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) posFlow += rawMoneyFlow[j];
      else negFlow += rawMoneyFlow[j];
    }
    const ratio = negFlow === 0 ? 100 : posFlow / negFlow;
    result[i] = 100 - 100 / (1 + ratio);
  }
  return result;
}

export type Signal = "buy" | "sell" | "neutral";

export interface AnalysisResult {
  signal: Signal;
  score: number;
  reasons: string[];
  rsiValue: number;
  macdValue: number;
  mfiValue: number;
  ma20: number;
  ma50: number;
  currentPrice: number;
}

export function analyzeStock(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): AnalysisResult {
  const n = closes.length;
  if (n < 30) {
    return {
      signal: "neutral",
      score: 0,
      reasons: ["Yetersiz veri"],
      rsiValue: NaN,
      macdValue: NaN,
      mfiValue: NaN,
      ma20: NaN,
      ma50: NaN,
      currentPrice: closes[n - 1] ?? 0,
    };
  }

  const currentPrice = closes[n - 1];
  const rsiArr = rsi(closes, 14);
  const rsiVal = rsiArr[n - 1] ?? NaN;
  const macdResult = macd(closes);
  const macdVal = macdResult.macd[n - 1] ?? NaN;
  const macdHist = macdResult.histogram[n - 1] ?? NaN;
  const prevHist = macdResult.histogram[n - 2] ?? NaN;
  const ma20Arr = sma(closes, 20);
  const ma50Arr = sma(closes, 50);
  const ma20 = ma20Arr[n - 1] ?? NaN;
  const ma50 = ma50Arr[n - 1] ?? NaN;
  const mfiArr = moneyFlowIndex(highs, lows, closes, volumes, 14);
  const mfiVal = mfiArr[n - 1] ?? NaN;

  let score = 0;
  const reasons: string[] = [];

  if (!isNaN(rsiVal)) {
    if (rsiVal < 30) { score += 2; reasons.push(`RSI aşırı satım (${rsiVal.toFixed(0)})`); }
    else if (rsiVal < 45) { score += 1; reasons.push(`RSI düşük bölge (${rsiVal.toFixed(0)})`); }
    else if (rsiVal > 70) { score -= 2; reasons.push(`RSI aşırı alım (${rsiVal.toFixed(0)})`); }
    else if (rsiVal > 55) { score -= 1; reasons.push(`RSI yüksek bölge (${rsiVal.toFixed(0)})`); }
  }

  if (!isNaN(macdHist) && !isNaN(prevHist)) {
    if (macdHist > 0 && prevHist < 0) { score += 2; reasons.push("MACD yukarı kesim"); }
    else if (macdHist > 0) { score += 1; reasons.push("MACD pozitif"); }
    else if (macdHist < 0 && prevHist > 0) { score -= 2; reasons.push("MACD aşağı kesim"); }
    else { score -= 1; reasons.push("MACD negatif"); }
  }

  if (!isNaN(ma20) && !isNaN(ma50)) {
    if (currentPrice > ma20 && currentPrice > ma50) { score += 1; reasons.push("Fiyat MA20 & MA50 üstünde"); }
    else if (currentPrice < ma20 && currentPrice < ma50) { score -= 1; reasons.push("Fiyat MA20 & MA50 altında"); }
    if (ma20 > ma50) { score += 1; reasons.push("MA20 > MA50 (yükseliş trendi)"); }
    else { score -= 1; reasons.push("MA20 < MA50 (düşüş trendi)"); }
  }

  if (!isNaN(mfiVal)) {
    if (mfiVal < 20) { score += 1; reasons.push(`Para akışı düşük (MFI: ${mfiVal.toFixed(0)})`); }
    else if (mfiVal > 80) { score -= 1; reasons.push(`Para akışı yüksek (MFI: ${mfiVal.toFixed(0)})`); }
  }

  let signal: Signal = "neutral";
  if (score >= 3) signal = "buy";
  else if (score <= -3) signal = "sell";

  return {
    signal,
    score,
    reasons,
    rsiValue: rsiVal,
    macdValue: macdVal,
    mfiValue: mfiVal,
    ma20,
    ma50,
    currentPrice,
  };
}
