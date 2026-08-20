import { Hisse } from "@/services/collectApi";
import { fetchChartData } from "@/utils/yahooFinance";
import { analyzeDailySetup, DailyTrendDirection, macd } from "@/utils/indicators";

export type TreydEtiketi = "GÜÇLÜ ALIM" | "MOMENTUM KIRILIMI" | "TAKİP LİSTESİ";

const TOTAL_CONFIRMATIONS = 6;
const MOMENTUM_CONFIRMATIONS_REQUIRED = 5;

export type TreydSinyali = {
  sembol: string;
  fiyat: number;
  degisimYuzde: number;
  hacim: number;
  goreceliHacim: number;
  skor: number;
  etiket: TreydEtiketi;
  trendTeyitli: boolean;
  gunlukTrend: DailyTrendDirection;
  direnc: number;
  direncKirildi: boolean;
  hacimTeyitli: boolean;
  rsiValue: number;
  rsiUygun: boolean;
  yuksekDip: boolean;
  yuksekTepe: boolean;
  yapiTeyitli: boolean;
  teyitSayisi: number;
  toplamTeyit: number;
  teyitler: string[];
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const calculateMedian = (values: number[]): number => {
  const validValues = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (validValues.length === 0) return 0;
  const middle = Math.floor(validValues.length / 2);
  return validValues.length % 2 === 0
    ? (validValues[middle - 1] + validValues[middle]) / 2
    : validValues[middle];
};

const getQuoteCandidate = (hisse: Hisse, medianVolume: number): TreydSinyali => {
  const volumeBaseline = hisse.ortalamaHacim && hisse.ortalamaHacim > 0
    ? hisse.ortalamaHacim
    : medianVolume;
  const goreceliHacim = volumeBaseline > 0 ? hisse.hacim / volumeBaseline : 1;
  const boundedRelativeVolume = clamp(goreceliHacim, 0.5, 3);
  const priceComponent = clamp(hisse.degisimYuzde / 2, -2, 2);
  const volumeComponent = clamp((boundedRelativeVolume - 1) / 1.5, -0.35, 1.25);
  const skor = priceComponent * 0.75 + volumeComponent * 0.25;

  return {
    sembol: hisse.sembol,
    fiyat: hisse.fiyat,
    degisimYuzde: hisse.degisimYuzde,
    hacim: hisse.hacim,
    goreceliHacim,
    skor,
    etiket: skor >= 0.9 ? "MOMENTUM KIRILIMI" : "TAKİP LİSTESİ",
    trendTeyitli: false,
    gunlukTrend: "sideways",
    direnc: NaN,
    direncKirildi: false,
    hacimTeyitli: false,
    rsiValue: NaN,
    rsiUygun: false,
    yuksekDip: false,
    yuksekTepe: false,
    yapiTeyitli: false,
    teyitSayisi: 0,
    toplamTeyit: TOTAL_CONFIRMATIONS,
    teyitler: ["Günlük fiyat değişimi ve göreceli hacim ön taraması"],
  };
};

export const getTop6Treyd = (hisseler: Hisse[]): TreydSinyali[] => {
  const validStocks = hisseler.filter(
    (hisse) =>
      Number.isFinite(hisse.fiyat) &&
      hisse.fiyat > 0 &&
      Number.isFinite(hisse.degisimYuzde) &&
      Number.isFinite(hisse.hacim) &&
      hisse.degisimYuzde > 0,
  );
  const medianVolume = calculateMedian(validStocks.map((hisse) => hisse.hacim));
  if (medianVolume <= 0 || validStocks.length === 0) return [];

  return validStocks
    .map((hisse) => getQuoteCandidate(hisse, medianVolume))
    .sort((a, b) => b.skor - a.skor)
    .slice(0, 6);
};

const addSetupReason = (reasons: string[], label: string, confirmed: boolean): void => {
  reasons.push(`${confirmed ? "✓" : "—"} ${label}`);
};

const confirmCandidate = async (candidate: TreydSinyali): Promise<TreydSinyali> => {
  try {
    const chart = await fetchChartData(candidate.sembol, "3mo");
    if (!chart || chart.closes.length < 60) {
      return {
        ...candidate,
        etiket: "TAKİP LİSTESİ",
        teyitler: ["— Günlük tarihsel teyit için yeterli veri alınamadı"],
      };
    }

    const daily = analyzeDailySetup(chart.closes, chart.highs, chart.lows, chart.volumes);
    const lastCompletedIdx = chart.closes.length >= 2 ? chart.closes.length - 2 : chart.closes.length - 1;
    const macdSeries = macd(chart.closes);
    const macdHistogram = macdSeries.histogram[lastCompletedIdx] ?? NaN;
    const previousMacdHistogram = macdSeries.histogram[Math.max(0, lastCompletedIdx - 1)] ?? NaN;
    const macdConfirmed =
      Number.isFinite(macdHistogram) &&
      Number.isFinite(previousMacdHistogram) &&
      macdHistogram > 0 &&
      macdHistogram >= previousMacdHistogram;
    const trendConfirmed = daily.dailyTrend === "up";
    const confirmations = [
      trendConfirmed,
      daily.resistanceBreakout,
      daily.volumeConfirmed,
      daily.rsiFavorable,
      daily.structureConfirmed,
      macdConfirmed,
    ];
    const teyitSayisi = confirmations.filter(Boolean).length;
    const teyitler: string[] = [];

    addSetupReason(teyitler, `Günlük trend yükseliş (${daily.dailyTrend})`, trendConfirmed);
    addSetupReason(
      teyitler,
      Number.isFinite(daily.resistance)
        ? `Direnç kırılımı (₺${daily.resistance.toFixed(2)})`
        : "Direnç seviyesi hesaplanamadı",
      daily.resistanceBreakout,
    );
    addSetupReason(
      teyitler,
      Number.isFinite(daily.relativeVolume)
        ? `Hacim teyidi (RVOL ${daily.relativeVolume.toFixed(2)}x)`
        : "Hacim teyidi hesaplanamadı",
      daily.volumeConfirmed,
    );
    addSetupReason(
      teyitler,
      Number.isFinite(daily.rsiValue)
        ? `RSI uygun bölge (${daily.rsiValue.toFixed(0)})`
        : "RSI hesaplanamadı",
      daily.rsiFavorable,
    );
    addSetupReason(
      teyitler,
      "Yüksek dip + yüksek tepe yapısı",
      daily.structureConfirmed,
    );
    addSetupReason(teyitler, "MACD histogramı pozitif ve yükseliyor", macdConfirmed);

    const strongBuy =
      candidate.degisimYuzde >= 0.75 &&
      trendConfirmed &&
      daily.resistanceBreakout &&
      daily.volumeConfirmed &&
      daily.rsiFavorable &&
      daily.structureConfirmed &&
      macdConfirmed;
    // Günlük yüzde yükselişi tek başına momentum kabul etmiyoruz.
    // Momentum etiketi için en az 5/6 teyit ve kırılım/yapı şartı gerekir.
    const momentumBreakout =
      daily.dailyTrend !== "down" &&
      teyitSayisi >= MOMENTUM_CONFIRMATIONS_REQUIRED &&
      (daily.resistanceBreakout || daily.structureConfirmed);
    const etiket: TreydEtiketi = strongBuy
      ? "GÜÇLÜ ALIM"
      : momentumBreakout
        ? "MOMENTUM KIRILIMI"
        : "TAKİP LİSTESİ";

    return {
      ...candidate,
      skor: candidate.skor + teyitSayisi * 0.2 + (daily.resistanceBreakout ? 0.2 : 0),
      etiket,
      trendTeyitli: trendConfirmed,
      gunlukTrend: daily.dailyTrend,
      direnc: daily.resistance,
      direncKirildi: daily.resistanceBreakout,
      hacimTeyitli: daily.volumeConfirmed,
      rsiValue: daily.rsiValue,
      rsiUygun: daily.rsiFavorable,
      yuksekDip: daily.higherLow,
      yuksekTepe: daily.higherHigh,
      yapiTeyitli: daily.structureConfirmed,
      teyitSayisi,
      toplamTeyit: TOTAL_CONFIRMATIONS,
      teyitler,
    };
  } catch {
    return {
      ...candidate,
      etiket: "TAKİP LİSTESİ",
      teyitler: ["— Tarihsel veri alınamadı; güvenli modda gösteriliyor"],
    };
  }
};

export const getTop6TreydWithConfirmation = async (
  hisseler: Hisse[],
): Promise<TreydSinyali[]> => {
  const candidates = getTop6Treyd(hisseler);
  if (candidates.length === 0) return [];

  const confirmed = await Promise.all(candidates.map(confirmCandidate));
  return confirmed.sort((a, b) => b.skor - a.skor).slice(0, 6);
};
