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

export function alma(
  prices: number[],
  period = 9,
  offset = 0.85,
  sigma = 6,
): number[] {
  const result: number[] = new Array(prices.length).fill(NaN);
  const center = offset * (period - 1);
  const denominator = 2 * sigma * sigma;
  const weights = Array.from({ length: period }, (_, i) =>
    Math.exp(-Math.pow(i - center, 2) / denominator),
  );
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  for (let i = period - 1; i < prices.length; i++) {
    const window = prices.slice(i - period + 1, i + 1);
    result[i] =
      window.reduce((sum, price, index) => sum + price * weights[index], 0) /
      weightTotal;
  }
  return result;
}

export function tilsonT3(
  prices: number[],
  period = 5,
  volumeFactor = 0.7,
): number[] {
  const smooth = (input: number[]) => {
    const result: number[] = new Array(input.length).fill(NaN);
    let previous = NaN;
    let count = 0;
    for (let i = 0; i < input.length; i++) {
      const value = input[i];
      if (isNaN(value)) continue;
      if (isNaN(previous)) {
        previous = value;
      } else {
        previous = value * (2 / (period + 1)) + previous * (1 - 2 / (period + 1));
      }
      count++;
      if (count >= period) result[i] = previous;
    }
    return result;
  };
  const e1 = smooth(prices);
  const e2 = smooth(e1);
  const e3 = smooth(e2);
  const e4 = smooth(e3);
  const e5 = smooth(e4);
  const e6 = smooth(e5);
  const result: number[] = new Array(prices.length).fill(NaN);
  const v = volumeFactor;
  const c1 = -v * v * v;
  const c2 = 3 * v * v + 3 * v * v * v;
  const c3 = -6 * v * v - 3 * v - 3 * v * v * v;
  const c4 = 1 + 3 * v + v * v * v + 3 * v * v;

  for (let i = 0; i < prices.length; i++) {
    if (isNaN(e6[i]) || isNaN(e5[i]) || isNaN(e4[i]) || isNaN(e3[i])) continue;
    result[i] =
      c1 * e6[i] +
      c2 * e5[i] +
      c3 * e4[i] +
      c4 * e3[i];
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

export type Signal = "buy" | "sell" | "neutral";

export type SignalStrength = "güçlü" | "orta" | "zayıf";

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
  strength: SignalStrength;
  volumeConfirmed: boolean;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
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
    strength: "zayıf",
    volumeConfirmed: false,
    stopLoss: NaN,
    takeProfit: NaN,
    riskRewardRatio: NaN,
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

  /* Volume confirmation: son TAMAMLANMIŞ günün hacmi, önceki 20 günlük ortalamanın üstünde mi?
     Not: Son bar piyasa açıkken kısmi (gün içi) olabileceğinden, hacim karşılaştırması
     son tamamlanmış bar (n-2) ile yapılır; bu da "hep düşük çıkma" yanlış pozitifini önler. */
  const lastCompletedIdx = n - 2 >= 0 ? n - 2 : n - 1;
  const priorVolumes = volumes.slice(Math.max(0, lastCompletedIdx - 20), lastCompletedIdx);
  const avgVolume = priorVolumes.reduce((a, b) => a + b, 0) / (priorVolumes.length || 1);
  const lastVolume = volumes[lastCompletedIdx] ?? 0;
  const volumeConfirmed = avgVolume > 0 && lastVolume >= avgVolume * 0.85;

  if (volumeConfirmed && score > 0) { score += 1; reasons.push("Hacim ortalamanın üzerinde (teyit)"); }
  else if (volumeConfirmed && score < 0) { score -= 1; reasons.push("Hacim ortalamanın üzerinde (teyit)"); }

  let signal: Signal = "neutral";
  if (score >= 3) signal = "buy";
  else if (score <= -3) signal = "sell";

  const absScore = Math.abs(score);
  const strength: SignalStrength = absScore >= 7 ? "güçlü" : absScore >= 4 ? "orta" : "zayıf";

  /* ATR bazlı stop-loss / take-profit (1.5x risk, 2.5x hedef -> ~1:1.67 R/R) */
  let stopLoss = NaN;
  let takeProfit = NaN;
  let riskRewardRatio = NaN;
  if (!isNaN(atrVal) && atrVal > 0) {
    if (signal === "sell") {
      stopLoss = currentPrice + atrVal * 1.5;
      takeProfit = currentPrice - atrVal * 2.5;
    } else {
      /* buy veya neutral -> uzun (long) pozisyon referansı gösterilir */
      stopLoss = currentPrice - atrVal * 1.5;
      takeProfit = currentPrice + atrVal * 2.5;
    }
    if (!isNaN(stopLoss)) {
      const risk = Math.abs(currentPrice - stopLoss);
      const reward = Math.abs(takeProfit - currentPrice);
      riskRewardRatio = risk > 0 ? reward / risk : NaN;
    }
  }

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
    strength,
    volumeConfirmed,
    stopLoss,
    takeProfit,
    riskRewardRatio,
  };
}

export function getActionAdvice(a: AnalysisResult): string {
  if (a.signal === "buy") {
    if (a.strength === "güçlü" && a.volumeConfirmed) {
      return "Birden fazla gösterge aynı yönde ve hacimle teyitli: göreceli olarak daha güçlü bir alım fırsatı. Yine de tek seferde değil, kademeli alım ve belirlenen zarar-kes seviyesine uyum önerilir.";
    }
    if (!a.volumeConfirmed) {
      return "Göstergeler alım yönünde ama hacim teyidi zayıf. Acele etmeyin; hacmin artmasını veya ek bir teyit sinyalini bekleyebilirsiniz.";
    }
    return "Göstergeler alım yönünde ama sinyal gücü orta/zayıf. Küçük pozisyonla başlayıp zarar-kes seviyesine sadık kalmak mantıklı olur.";
  }
  if (a.signal === "sell") {
    if (a.strength === "güçlü" && a.volumeConfirmed) {
      return "Birden fazla gösterge aynı yönde ve hacimle teyitli: satış/uzak durma sinyali güçlü görünüyor. Elinizde pozisyon varsa kâr/zarar kes seviyelerini gözden geçirin.";
    }
    if (!a.volumeConfirmed) {
      return "Göstergeler satış yönünde ama hacim teyidi zayıf. Panik satıştan kaçının, ek teyit bekleyebilirsiniz.";
    }
    return "Göstergeler satış yönünde ama sinyal gücü orta/zayıf. Pozisyonunuz varsa riskinizi azaltmayı düşünebilirsiniz.";
  }
  return "Göstergeler net bir yön göstermiyor (birbirini nötrleyen sinyaller var). Bu genelde kararsız/yatay bir piyasa anlamına gelir; net bir sinyal oluşana kadar beklemek, yeni pozisyon açmamak mantıklı olur.";
}



export type DailyTrendDirection = "up" | "sideways" | "down";

export interface DailySetupAnalysis {
  dailyTrend: DailyTrendDirection;
  resistance: number;
  resistanceBreakout: boolean;
  relativeVolume: number;
  volumeConfirmed: boolean;
  rsiValue: number;
  rsiFavorable: boolean;
  higherHigh: boolean;
  higherLow: boolean;
  structureConfirmed: boolean;
}

const averageOf = (values: number[]): number => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  return valid.length > 0 ? valid.reduce((sum, value) => sum + value, 0) / valid.length : NaN;
};

/**
 * Günlük Trade filtresi. Son bar açık seansın kısmi barı olabilir; bu yüzden
 * mümkün olduğunda n-2, yani son tamamlanmış günlük bar kullanılır.
 */
export function analyzeDailySetup(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
): DailySetupAnalysis {
  const empty: DailySetupAnalysis = {
    dailyTrend: "sideways",
    resistance: NaN,
    resistanceBreakout: false,
    relativeVolume: NaN,
    volumeConfirmed: false,
    rsiValue: NaN,
    rsiFavorable: false,
    higherHigh: false,
    higherLow: false,
    structureConfirmed: false,
  };

  const n = Math.min(closes.length, highs.length, lows.length, volumes.length);
  if (n < 30) return empty;

  const last = n >= 2 ? n - 2 : n - 1;
  const lastClose = closes[last];
  if (!Number.isFinite(lastClose) || lastClose <= 0) return empty;

  const ma20Arr = sma(closes, 20);
  const ma50Arr = sma(closes, 50);
  const ma20 = ma20Arr[last];
  const ma50 = ma50Arr[last];
  const previousMa20 = ma20Arr[Math.max(0, last - 5)];
  const dailyTrend: DailyTrendDirection =
    Number.isFinite(ma20) && Number.isFinite(ma50) && Number.isFinite(previousMa20)
      ? lastClose > ma20 && ma20 > ma50 && ma20 > previousMa20
        ? "up"
        : lastClose < ma20 && ma20 < ma50 && ma20 < previousMa20
          ? "down"
          : "sideways"
      : "sideways";

  const resistanceStart = Math.max(0, last - 20);
  const resistanceValues = highs
    .slice(resistanceStart, last)
    .filter((value) => Number.isFinite(value) && value > 0);
  const resistance = resistanceValues.length > 0 ? Math.max(...resistanceValues) : NaN;
  const resistanceBreakout =
    Number.isFinite(resistance) &&
    lastClose > resistance * 1.003 &&
    lastClose > (closes[last - 1] ?? 0);

  const volumeWindow = volumes
    .slice(Math.max(0, last - 20), last)
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageVolume = averageOf(volumeWindow);
  const currentVolume = volumes[last] ?? 0;
  const relativeVolume = averageVolume > 0 ? currentVolume / averageVolume : NaN;
  const volumeConfirmed = Number.isFinite(relativeVolume) && relativeVolume >= 1.2;

  const rsiValue = rsi(closes)[last] ?? NaN;
  const rsiFavorable = Number.isFinite(rsiValue) && rsiValue >= 50 && rsiValue <= 72;

  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];
  const pivotStart = Math.max(2, last - 60);
  for (let i = pivotStart; i <= last - 2; i += 1) {
    const high = highs[i];
    const low = lows[i];
    if (!Number.isFinite(high) || !Number.isFinite(low) || high <= 0 || low <= 0) continue;
    const highIsPivot =
      high >= highs[i - 1] && high >= highs[i - 2] && high >= highs[i + 1] && high >= highs[i + 2];
    const lowIsPivot =
      low <= lows[i - 1] && low <= lows[i - 2] && low <= lows[i + 1] && low <= lows[i + 2];
    if (highIsPivot) pivotHighs.push(high);
    if (lowIsPivot) pivotLows.push(low);
  }

  const previousHigh = pivotHighs.at(-2);
  const latestHigh = pivotHighs.at(-1);
  const previousLow = pivotLows.at(-2);
  const latestLow = pivotLows.at(-1);
  const higherHigh =
    previousHigh !== undefined && latestHigh !== undefined && latestHigh > previousHigh * 1.002;
  const higherLow =
    previousLow !== undefined && latestLow !== undefined && latestLow > previousLow * 1.002;

  return {
    dailyTrend,
    resistance,
    resistanceBreakout,
    relativeVolume,
    volumeConfirmed,
    rsiValue,
    rsiFavorable,
    higherHigh,
    higherLow,
    structureConfirmed: higherHigh && higherLow,
  };
}
