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

/* ─── ATR (Average True Range) ─── */
export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  const trueRanges: number[] = [NaN];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hpc = Math.abs(highs[i] - closes[i - 1]);
    const lpc = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(hl, hpc, lpc));
  }
  let atrVal = 0;
  for (let i = 1; i <= period; i++) atrVal += trueRanges[i];
  atrVal /= period;
  result[period] = atrVal;
  for (let i = period + 1; i < closes.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i]) / period;
    result[i] = atrVal;
  }
  return result;
}

/* ─── Aroon (Up, Down, Oscillator) ─── */
export interface AroonResult {
  up: number[];
  down: number[];
  oscillator: number[];
}

export function aroon(
  highs: number[],
  lows: number[],
  period = 25
): AroonResult {
  const up: number[] = new Array(highs.length).fill(NaN);
  const down: number[] = new Array(lows.length).fill(NaN);
  const oscillator: number[] = new Array(highs.length).fill(NaN);

  for (let i = period; i < highs.length; i++) {
    const sliceH = highs.slice(i - period, i + 1);
    const sliceL = lows.slice(i - period, i + 1);
    const maxIdx = sliceH.reduce((best, v, idx) => (v > sliceH[best] ? idx : best), 0);
    const minIdx = sliceL.reduce((best, v, idx) => (v < sliceL[best] ? idx : best), 0);
    const aroonUp = ((maxIdx) / period) * 100;
    const aroonDown = ((minIdx) / period) * 100;
    up[i] = aroonUp;
    down[i] = aroonDown;
    oscillator[i] = aroonUp - aroonDown;
  }
  return { up, down, oscillator };
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
  atrValue: number;
  stochK: number;
  stochD: number;
  aroonUp: number;
  aroonDown: number;
  aroonOsc: number;
}

export function analyzeStock(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): AnalysisResult {
  const n = closes.length;
  const empty: AnalysisResult = {
    signal: "neutral",
    score: 0,
    reasons: ["Yetersiz veri"],
    rsiValue: NaN,
    macdValue: NaN,
    mfiValue: NaN,
    ma20: NaN,
    ma50: NaN,
    currentPrice: closes[n - 1] ?? 0,
    atrValue: NaN,
    stochK: NaN,
    stochD: NaN,
    aroonUp: NaN,
    aroonDown: NaN,
    aroonOsc: NaN,
  };
  if (n < 30) return empty;

  const currentPrice = closes[n - 1];

  /* --- existing indicators --- */
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

  /* --- new indicators --- */
  const atrArr = atr(highs, lows, closes, 14);
  const atrVal = atrArr[n - 1] ?? NaN;

  const stochResult = stochastic(highs, lows, closes, 14, 3);
  const stochK = stochResult.k[n - 1] ?? NaN;
  const stochD = stochResult.d[n - 1] ?? NaN;
  const prevStochK = stochResult.k[n - 2] ?? NaN;
  const prevStochD = stochResult.d[n - 2] ?? NaN;

  const aroonResult = aroon(highs, lows, 25);
  const aroonUp = aroonResult.up[n - 1] ?? NaN;
  const aroonDown = aroonResult.down[n - 1] ?? NaN;
  const aroonOsc = aroonResult.oscillator[n - 1] ?? NaN;

  let score = 0;
  const reasons: string[] = [];

  /* RSI */
  if (!isNaN(rsiVal)) {
    if (rsiVal < 30) { score += 2; reasons.push(`RSI aşırı satım (${rsiVal.toFixed(0)})`); }
    else if (rsiVal < 45) { score += 1; reasons.push(`RSI düşük bölge (${rsiVal.toFixed(0)})`); }
    else if (rsiVal > 70) { score -= 2; reasons.push(`RSI aşırı alım (${rsiVal.toFixed(0)})`); }
    else if (rsiVal > 55) { score -= 1; reasons.push(`RSI yüksek bölge (${rsiVal.toFixed(0)})`); }
  }

  /* MACD */
  if (!isNaN(macdHist) && !isNaN(prevHist)) {
    if (macdHist > 0 && prevHist < 0) { score += 2; reasons.push("MACD yukarı kesim"); }
    else if (macdHist > 0) { score += 1; reasons.push("MACD pozitif"); }
    else if (macdHist < 0 && prevHist > 0) { score -= 2; reasons.push("MACD aşağı kesim"); }
    else { score -= 1; reasons.push("MACD negatif"); }
  }

  /* MA */
  if (!isNaN(ma20) && !isNaN(ma50)) {
    if (currentPrice > ma20 && currentPrice > ma50) { score += 1; reasons.push("Fiyat MA20 & MA50 üstünde"); }
    else if (currentPrice < ma20 && currentPrice < ma50) { score -= 1; reasons.push("Fiyat MA20 & MA50 altında"); }
    if (ma20 > ma50) { score += 1; reasons.push("MA20 > MA50 (yükseliş trendi)"); }
    else { score -= 1; reasons.push("MA20 < MA50 (düşüş trendi)"); }
  }

  /* MFI */
  if (!isNaN(mfiVal)) {
    if (mfiVal < 20) { score += 1; reasons.push(`Para akışı düşük (MFI: ${mfiVal.toFixed(0)})`); }
    else if (mfiVal > 80) { score -= 1; reasons.push(`Para akışı yüksek (MFI: ${mfiVal.toFixed(0)})`); }
  }

  /* Stochastic */
  if (!isNaN(stochK) && !isNaN(stochD) && !isNaN(prevStochK) && !isNaN(prevStochD)) {
    const crossedUp = prevStochK <= prevStochD && stochK > stochD;
    const crossedDown = prevStochK >= prevStochD && stochK < stochD;
    if (stochK < 20 && crossedUp) { score += 2; reasons.push(`Stochastic aşırı satım + yukarı kesim (%K:${stochK.toFixed(0)})`); }
    else if (stochK < 20) { score += 1; reasons.push(`Stochastic aşırı satım bölgesi (%K:${stochK.toFixed(0)})`); }
    else if (stochK > 80 && crossedDown) { score -= 2; reasons.push(`Stochastic aşırı alım + aşağı kesim (%K:${stochK.toFixed(0)})`); }
    else if (stochK > 80) { score -= 1; reasons.push(`Stochastic aşırı alım bölgesi (%K:${stochK.toFixed(0)})`); }
  }

  /* Aroon */
  if (!isNaN(aroonOsc)) {
    if (aroonUp > 70 && aroonDown < 30) { score += 2; reasons.push(`Aroon güçlü yükseliş trendi (↑${aroonUp.toFixed(0)})`); }
    else if (aroonOsc > 40) { score += 1; reasons.push(`Aroon pozitif (${aroonOsc.toFixed(0)})`); }
    else if (aroonDown > 70 && aroonUp < 30) { score -= 2; reasons.push(`Aroon güçlü düşüş trendi (↓${aroonDown.toFixed(0)})`); }
    else if (aroonOsc < -40) { score -= 1; reasons.push(`Aroon negatif (${aroonOsc.toFixed(0)})`); }
  }

  let signal: Signal = "neutral";
  if (score >= 4) signal = "buy";
  else if (score <= -4) signal = "sell";

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
    atrValue: atrVal,
    stochK,
    stochD,
    aroonUp,
    aroonDown,
    aroonOsc,
  };
}

export type CandleDirection = "bullish" | "bearish" | "neutral";

export interface CandlePattern {
  name: string;
  direction: CandleDirection;
  emoji: string;
}

export function detectCandlePatterns(
  opens: number[],
  highs: number[],
  lows: number[],
  closes: number[]
): CandlePattern[] {
  const n = closes.length;
  if (n < 3) return [];

  const patterns: CandlePattern[] = [];

  const o = opens[n - 1], h = highs[n - 1], l = lows[n - 1], c = closes[n - 1];
  const o2 = opens[n - 2], h2 = highs[n - 2], l2 = lows[n - 2], c2 = closes[n - 2];
  const c3 = closes[n - 3];

  const body = Math.abs(c - o);
  const body2 = Math.abs(c2 - o2);
  const range = h - l;
  const range2 = h2 - l2;
  const upperWick = h - Math.max(o, c);
  const lowerWick = Math.min(o, c) - l;
  const upperWick2 = h2 - Math.max(o2, c2);
  const lowerWick2 = Math.min(o2, c2) - l2;
  const isBull = c > o;
  const isBull2 = c2 > o2;
  const midBody2 = (o2 + c2) / 2;

  if (range > 0) {
    const bodyRatio = body / range;

    if (bodyRatio < 0.1) {
      patterns.push({ name: "Doji", direction: "neutral", emoji: "⚖️" });
    }

    if (isBull && lowerWick > body * 2 && upperWick < body * 0.5 && lowerWick > range * 0.5) {
      patterns.push({ name: "Çekiç", direction: "bullish", emoji: "🔨" });
    }

    if (!isBull && lowerWick > body * 2 && upperWick < body * 0.5 && lowerWick > range * 0.5) {
      patterns.push({ name: "Asılı Adam", direction: "bearish", emoji: "🪝" });
    }

    if (!isBull && upperWick > body * 2 && lowerWick < body * 0.5 && upperWick > range * 0.5) {
      patterns.push({ name: "Kayan Yıldız", direction: "bearish", emoji: "💫" });
    }

    if (isBull && upperWick > body * 2 && lowerWick < body * 0.5 && upperWick > range * 0.5) {
      patterns.push({ name: "Ters Çekiç", direction: "bullish", emoji: "🌟" });
    }

    if (isBull && bodyRatio > 0.7 && c >= h2 && o <= l2) {
      patterns.push({ name: "Yutan Boğa", direction: "bullish", emoji: "🐂" });
    } else if (isBull && !isBull2 && c > midBody2 && o < c2) {
      patterns.push({ name: "Hamile Boğa", direction: "bullish", emoji: "📈" });
    }

    if (!isBull && bodyRatio > 0.7 && c <= l2 && o >= h2) {
      patterns.push({ name: "Yutan Ayı", direction: "bearish", emoji: "🐻" });
    } else if (!isBull && isBull2 && c < midBody2 && o > c2) {
      patterns.push({ name: "Hamile Ayı", direction: "bearish", emoji: "📉" });
    }

    if (isBull2 && body2 > 0 && upperWick2 < body2 * 0.3) {
      const o3 = opens[n - 3];
      const isBear3 = c3 < o3;
      if (isBear3 && isBull && c > midBody2) {
        patterns.push({ name: "Sabah Yıldızı", direction: "bullish", emoji: "🌅" });
      }
    }

    if (!isBull2 && body2 > 0 && lowerWick2 < body2 * 0.3) {
      const o3 = opens[n - 3];
      const isBull3 = c3 > o3;
      if (isBull3 && !isBull && c < midBody2) {
        patterns.push({ name: "Akşam Yıldızı", direction: "bearish", emoji: "🌆" });
      }
    }

    if (Math.abs(c2 - o2) / (range2 || 1) > 0.6 && isBull2 && isBull && c > c2) {
      patterns.push({ name: "İki Beyaz Mum", direction: "bullish", emoji: "🕯️" });
    }
    if (Math.abs(c2 - o2) / (range2 || 1) > 0.6 && !isBull2 && !isBull && c < c2) {
      patterns.push({ name: "İki Kara Mum", direction: "bearish", emoji: "🕯️" });
    }
  }

  return patterns;
}

export function getOverallCandleDirection(patterns: CandlePattern[]): CandleDirection {
  if (patterns.length === 0) return "neutral";
  const bull = patterns.filter((p) => p.direction === "bullish").length;
  const bear = patterns.filter((p) => p.direction === "bearish").length;
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}

export function detectSingleCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  prevClose: number
): CandlePattern | null {
  const body = Math.abs(close - open);
  const range = high - low;
  if (range === 0) return null;
  const bodyRatio = body / range;
  const isBull = close >= open;
  const upperWick = high - Math.max(open, close);
  const lowerWick = Math.min(open, close) - low;

  if (bodyRatio < 0.08) {
    return { name: "Doji", direction: "neutral", emoji: "⚖️" };
  }
  if (lowerWick > body * 2 && upperWick < body * 0.5) {
    return isBull
      ? { name: "Çekiç", direction: "bullish", emoji: "🔨" }
      : { name: "Asılı Adam", direction: "bearish", emoji: "🪝" };
  }
  if (upperWick > body * 2 && lowerWick < body * 0.5) {
    return isBull
      ? { name: "Ters Çekiç", direction: "bullish", emoji: "🌟" }
      : { name: "Kayan Yıldız", direction: "bearish", emoji: "💫" };
  }
  if (bodyRatio > 0.65) {
    const gapUp = open > prevClose * 1.001;
    const gapDown = open < prevClose * 0.999;
    if (isBull && gapUp) return { name: "Güçlü Boğa", direction: "bullish", emoji: "🐂" };
    if (!isBull && gapDown) return { name: "Güçlü Ayı", direction: "bearish", emoji: "🐻" };
  }
  return null;
}
