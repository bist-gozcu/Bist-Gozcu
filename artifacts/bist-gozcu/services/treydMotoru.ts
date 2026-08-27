import { Hisse } from "@/services/collectApi";
import { BIST30_SET, BIST50_SET, getStockMeta } from "@/constants/bistStocks";
import { DataFreshness, fetchChartData } from "@/utils/yahooFinance";
import {
  analyzeDailySetup,
  analyzeOpeningBehavior,
  atr,
  DailyTrendDirection,
  macd,
} from "@/utils/indicators";
import { isPiyasaAcik } from "@/utils/seansKontrol";

export type TreydEtiketi = "GÜÇLÜ ALIM" | "MOMENTUM KIRILIMI" | "TAKİP LİSTESİ";
export type RadarDurumu = "gunluk_teyitli" | "gun_ici_izleme" | "erken_hareket";
export type ErkenHareketEtiketi =
  | "NORMAL"
  | "ERKEN İZLEME"
  | "HIZLI HAREKET — TEYİTSİZ"
  | "ERKEN HAREKET RADARI";
export type PiyasaHavasi =
  | "Genel piyasa destekli"
  | "Sektör destekli"
  | "Hisseye özgü ayrışma"
  | "Piyasa desteği zayıf";

const TOTAL_CONFIRMATIONS = 6;
const MOMENTUM_CONFIRMATIONS_REQUIRED = 5;
const INTRADAY_MIN_CONFIRMATIONS = 3;
const EARLY_RADAR_MIN_SCORE = 30;
const CANDIDATE_POOL_SIZE = 12;
const MIN_AVERAGE_TURNOVER_TL = 5_000_000;

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
  /** Günlük kapanış, gün içi izleme veya erken hareket durumu. */
  radarDurumu: RadarDurumu;
  /** Erken hareket puanı; günlük teyit puanından ayrı hesaplanır. */
  erkenHareketSkoru: number;
  /** Erken hareket puanının sade kullanıcı etiketi. */
  erkenHareketEtiketi: ErkenHareketEtiketi;
  /** Erken hareket puanını açıklayan kısa nedenler. */
  erkenHareketNedenleri: string[];
  /** Hissenin hareketinin piyasa/sektör desteğiyle ilişkisi. */
  piyasaHavasi: PiyasaHavasi;
  /** Quote verisinin tazelik sınıfı. */
  veriKalitesi: DataFreshness;
  /** Kullanıcıya gösterilecek veri uyarısı. */
  veriUyarisi: string | null;
  /** Quote kaynağının adı. */
  veriKaynagi: string;
  /** Kaynağın fiyatı son güncellediği Unix zamanı. */
  piyasaZamani: number | null;
};

type SectorSnapshot = {
  medianChange: number;
  positiveRatio: number;
  count: number;
};

type EarlyMovementContext = {
  marketMedianChange: number;
  marketPositiveRatio: number;
  sectors: Map<string, SectorSnapshot>;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isUsableQuote = (hisse: Hisse): boolean =>
  (hisse.veriKalitesi === "fresh" ||
    hisse.veriKalitesi === "slightly_delayed" ||
    hisse.veriKalitesi === "closed_reference") &&
  Number.isFinite(hisse.fiyat) &&
  hisse.fiyat > 0 &&
  Number.isFinite(hisse.degisimYuzde);

export const calculateMedian = (values: number[]): number => {
  const validValues = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (validValues.length === 0) return 0;
  const middle = Math.floor(validValues.length / 2);
  return validValues.length % 2 === 0
    ? (validValues[middle - 1] + validValues[middle]) / 2
    : validValues[middle];
};

const buildEarlyMovementContext = (hisseler: Hisse[]): EarlyMovementContext => {
  const validHisseler = hisseler.filter(isUsableQuote);
  const sectors = new Map<string, Hisse[]>();

  for (const hisse of validHisseler) {
    const sector = getStockMeta(hisse.sembol)?.sector;
    if (!sector) continue;
    const entries = sectors.get(sector) ?? [];
    entries.push(hisse);
    sectors.set(sector, entries);
  }

  const sectorSnapshots = new Map<string, SectorSnapshot>();
  for (const [sector, entries] of sectors) {
    sectorSnapshots.set(sector, {
      medianChange: calculateMedian(entries.map((entry) => entry.degisimYuzde)),
      positiveRatio:
        entries.length > 0
          ? entries.filter((entry) => entry.degisimYuzde > 0).length /
            entries.length
          : 0,
      count: entries.length,
    });
  }

  return {
    marketMedianChange: calculateMedian(
      validHisseler.map((hisse) => hisse.degisimYuzde),
    ),
    marketPositiveRatio:
      validHisseler.length > 0
        ? validHisseler.filter((hisse) => hisse.degisimYuzde > 0).length /
          validHisseler.length
        : 0,
    sectors: sectorSnapshots,
  };
};

const getQuoteCandidate = (
  hisse: Hisse,
  medianVolume: number,
): TreydSinyali => {
  const volumeBaseline =
    hisse.ortalamaHacim && hisse.ortalamaHacim > 0
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
    radarDurumu: isPiyasaAcik() ? "gun_ici_izleme" : "gunluk_teyitli",
    erkenHareketSkoru: 0,
    erkenHareketEtiketi: "NORMAL",
    erkenHareketNedenleri: [],
    piyasaHavasi: "Piyasa desteği zayıf",
    veriKalitesi: hisse.veriKalitesi,
    veriUyarisi: hisse.veriUyarisi,
    veriKaynagi: hisse.veriKaynagi,
    piyasaZamani: hisse.piyasaZamani,
  };
};

export const getTop6Treyd = (hisseler: Hisse[]): TreydSinyali[] => {
  const validStocks = hisseler.filter((hisse) => {
    const averageTurnover = (hisse.ortalamaHacim ?? 0) * hisse.fiyat;
    return (
      BIST50_SET.has(hisse.sembol) &&
      isUsableQuote(hisse) &&
      Number.isFinite(hisse.hacim) &&
      Number.isFinite(hisse.ortalamaHacim) &&
      (hisse.ortalamaHacim ?? 0) > 0 &&
      averageTurnover >= MIN_AVERAGE_TURNOVER_TL &&
      hisse.degisimYuzde > 0
    );
  });
  const medianVolume = calculateMedian(validStocks.map((hisse) => hisse.hacim));
  if (medianVolume <= 0 || validStocks.length === 0) return [];

  return validStocks
    .map((hisse) => getQuoteCandidate(hisse, medianVolume))
    .sort((a, b) => {
      const indexPriority =
        Number(BIST30_SET.has(b.sembol)) - Number(BIST30_SET.has(a.sembol));
      return indexPriority || b.skor - a.skor;
    })
    .slice(0, CANDIDATE_POOL_SIZE);
};

const addSetupReason = (
  reasons: string[],
  label: string,
  confirmed: boolean,
): void => {
  reasons.push(`${confirmed ? "✓" : "—"} ${label}`);
};

const signedPercent = (value: number): string =>
  `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const calculateEarlyMovement = (
  candidate: TreydSinyali,
  chart: Awaited<ReturnType<typeof fetchChartData>>,
  daily: ReturnType<typeof analyzeDailySetup>,
  context: EarlyMovementContext,
  lastCompletedIdx: number,
): Pick<
  TreydSinyali,
  | "erkenHareketSkoru"
  | "erkenHareketEtiketi"
  | "erkenHareketNedenleri"
  | "piyasaHavasi"
> => {
  const empty = {
    erkenHareketSkoru: 0,
    erkenHareketEtiketi: "NORMAL" as ErkenHareketEtiketi,
    erkenHareketNedenleri: ["— Erken hareket için yeterli günlük veri yok"],
    piyasaHavasi: "Piyasa desteği zayıf" as PiyasaHavasi,
  };
  if (!chart || lastCompletedIdx < 21) return empty;

  const completedClose = chart.closes[lastCompletedIdx];
  const previousClose = chart.closes[lastCompletedIdx - 1];
  const fiveDayBase = chart.closes[lastCompletedIdx - 5];
  if (
    !Number.isFinite(completedClose) ||
    !Number.isFinite(previousClose) ||
    !Number.isFinite(fiveDayBase) ||
    completedClose <= 0 ||
    previousClose <= 0 ||
    fiveDayBase <= 0
  )
    return empty;

  const completedDayChange =
    ((completedClose - previousClose) / previousClose) * 100;
  const fiveDayChange = ((completedClose - fiveDayBase) / fiveDayBase) * 100;
  const atrValue = atr(chart.highs, chart.lows, chart.closes, 14)[
    lastCompletedIdx
  ];
  const atrPercent =
    Number.isFinite(atrValue) && atrValue > 0
      ? (atrValue / completedClose) * 100
      : NaN;
  const impulseValues = [
    candidate.degisimYuzde,
    completedDayChange,
    fiveDayChange / 2,
  ].filter((value) => Number.isFinite(value));
  const impulse = impulseValues.length > 0 ? Math.max(...impulseValues) : 0;

  const priceScore =
    (Number.isFinite(atrPercent) && impulse >= atrPercent * 1.5) ||
    impulse >= 7 ||
    fiveDayChange >= 8
      ? 20
      : impulse >= 3 || fiveDayChange >= 5
        ? 14
        : impulse > 0 || fiveDayChange > 2
          ? 7
          : 0;

  const turnover = candidate.fiyat * candidate.hacim;
  const relativeVolume = Math.max(
    Number.isFinite(daily.relativeVolume) ? daily.relativeVolume : 0,
    Number.isFinite(candidate.goreceliHacim) ? candidate.goreceliHacim : 0,
  );
  const volumeScore =
    Number.isFinite(relativeVolume) &&
    relativeVolume >= 2 &&
    turnover >= 10_000_000
      ? 20
      : Number.isFinite(relativeVolume) &&
          relativeVolume >= 1.5 &&
          turnover >= MIN_AVERAGE_TURNOVER_TL
        ? 15
        : Number.isFinite(relativeVolume) &&
            relativeVolume >= 1.2 &&
            turnover >= MIN_AVERAGE_TURNOVER_TL
          ? 10
          : Number.isFinite(relativeVolume) && relativeVolume >= 1
            ? 5
            : 0;

  const resistanceDistance =
    Number.isFinite(daily.resistance) && daily.resistance > 0
      ? ((daily.resistance - candidate.fiyat) / candidate.fiyat) * 100
      : NaN;
  const resistanceScore = daily.resistanceBreakout
    ? 15
    : Number.isFinite(resistanceDistance) && resistanceDistance < 0
      ? 12
      : Number.isFinite(resistanceDistance) &&
          resistanceDistance >= 0 &&
          resistanceDistance <= 2
        ? 10
        : Number.isFinite(resistanceDistance) &&
            resistanceDistance > 2 &&
            resistanceDistance <= 5
          ? 6
          : 0;

  const sector = getStockMeta(candidate.sembol)?.sector;
  const sectorSnapshot = sector ? context.sectors.get(sector) : undefined;
  const marketRelative = candidate.degisimYuzde - context.marketMedianChange;
  const sectorMedian =
    sectorSnapshot?.medianChange ?? context.marketMedianChange;
  const sectorRelative = candidate.degisimYuzde - sectorMedian;
  const marketRelativeScore =
    marketRelative >= 3
      ? 10
      : marketRelative >= 1.5
        ? 7
        : marketRelative > 0
          ? 4
          : 0;
  const sectorRelativeScore =
    sectorRelative >= 3
      ? 10
      : sectorRelative >= 1.5
        ? 7
        : sectorRelative > 0
          ? 4
          : 0;

  const opening = analyzeOpeningBehavior(chart.opens, chart.closes, 50);
  const openingBias = opening
    ? opening.recentUpDays - opening.recentDownDays
    : 0;
  const lastGap = opening?.lastGapPercent ?? NaN;
  const openingScore =
    Number.isFinite(lastGap) && lastGap >= 1 && openingBias > 0
      ? 10
      : openingBias > 0
        ? 7
        : Number.isFinite(lastGap) && lastGap > 0
          ? 4
          : 0;

  const marketBreadthScore =
    context.marketPositiveRatio >= 0.6
      ? 7
      : context.marketPositiveRatio >= 0.5
        ? 4
        : 1;
  const sectorBreadthScore = sectorSnapshot
    ? sectorSnapshot.positiveRatio >= 0.6
      ? 8
      : sectorSnapshot.positiveRatio >= 0.5
        ? 4
        : 1
    : 0;

  const score = clamp(
    Math.round(
      priceScore +
        volumeScore +
        resistanceScore +
        marketRelativeScore +
        sectorRelativeScore +
        openingScore +
        marketBreadthScore +
        sectorBreadthScore,
    ),
    0,
    100,
  );
  const label: ErkenHareketEtiketi =
    score >= 70
      ? "ERKEN HAREKET RADARI"
      : score >= 50
        ? "HIZLI HAREKET — TEYİTSİZ"
        : score >= EARLY_RADAR_MIN_SCORE
          ? "ERKEN İZLEME"
          : "NORMAL";

  const piyasaHavasi: PiyasaHavasi =
    context.marketPositiveRatio >= 0.55 && marketRelative >= 0
      ? "Genel piyasa destekli"
      : sectorSnapshot &&
          sectorSnapshot.positiveRatio >= 0.55 &&
          sectorRelative >= 0
        ? "Sektör destekli"
        : marketRelative >= 2 || sectorRelative >= 2
          ? "Hisseye özgü ayrışma"
          : "Piyasa desteği zayıf";

  const reasons = [
    `${priceScore >= 14 ? "✓" : "—"} Fiyat ivmesi: gün ${signedPercent(completedDayChange)}, 5 gün ${signedPercent(fiveDayChange)}${Number.isFinite(atrPercent) ? `, ATR ${atrPercent.toFixed(2)}%` : ""}`,
    `${volumeScore >= 10 ? "✓" : "—"} RVOL ${Number.isFinite(relativeVolume) ? `${relativeVolume.toFixed(2)}x` : "hesaplanamadı"} · işlem değeri ₺${Math.round(turnover).toLocaleString("tr-TR")}`,
    `${resistanceScore >= 10 ? "✓" : "—"} ${daily.resistanceBreakout ? "Direnç üzerinde kapanış" : Number.isFinite(resistanceDistance) ? (resistanceDistance < 0 ? "Canlı fiyat direnç üzerinde" : `Dirence ${resistanceDistance.toFixed(2)}% mesafe`) : "Direnç hesaplanamadı"}`,
    `${marketRelativeScore >= 7 ? "✓" : "—"} BIST medyanına göre ${signedPercent(marketRelative)} · ${piyasaHavasi}`,
    `${sectorRelativeScore >= 7 ? "✓" : "—"} ${sector ?? "Sektör"} medyanına göre ${signedPercent(sectorRelative)}`,
    `${openingScore >= 7 ? "✓" : "—"} Açılış davranışı: ${opening ? `${opening.recentUpDays}/5 yukarı, ${opening.recentDownDays}/5 aşağı` : "hesaplanamadı"}`,
    `${marketBreadthScore + sectorBreadthScore >= 8 ? "✓" : "—"} Genişlik: BIST ${Math.round(context.marketPositiveRatio * 100)}% pozitif${sectorSnapshot ? ` · sektör ${Math.round(sectorSnapshot.positiveRatio * 100)}%` : ""}`,
  ];

  return {
    erkenHareketSkoru: score,
    erkenHareketEtiketi: label,
    erkenHareketNedenleri: reasons,
    piyasaHavasi,
  };
};

const confirmCandidate = async (
  candidate: TreydSinyali,
  context: EarlyMovementContext,
): Promise<TreydSinyali> => {
  try {
    const chart = await fetchChartData(candidate.sembol, "3mo");
    if (!chart || chart.closes.length < 60) {
      return {
        ...candidate,
        etiket: "TAKİP LİSTESİ",
        teyitler: ["— Günlük tarihsel teyit için yeterli veri alınamadı"],
      };
    }

    const daily = analyzeDailySetup(
      chart.closes,
      chart.highs,
      chart.lows,
      chart.volumes,
    );
    const lastCompletedIdx =
      chart.closes.length >= 2
        ? chart.closes.length - 2
        : chart.closes.length - 1;
    const macdSeries = macd(chart.closes);
    const macdHistogram = macdSeries.histogram[lastCompletedIdx] ?? NaN;
    const previousMacdHistogram =
      macdSeries.histogram[Math.max(0, lastCompletedIdx - 1)] ?? NaN;
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

    addSetupReason(
      teyitler,
      `Günlük trend yükseliş (${daily.dailyTrend})`,
      trendConfirmed,
    );
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
    addSetupReason(
      teyitler,
      "MACD histogramı pozitif ve yükseliyor",
      macdConfirmed,
    );

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

    const radarDurumu: RadarDurumu =
      teyitSayisi >= MOMENTUM_CONFIRMATIONS_REQUIRED
        ? "gunluk_teyitli"
        : "gun_ici_izleme";
    if (radarDurumu === "gun_ici_izleme") {
      teyitler.push(
        "ℹ Günlük kapanış teyidi 5/6 seviyesinde değil; yalnızca gün içi izleme",
      );
    }

    const earlyMovement = calculateEarlyMovement(
      candidate,
      chart,
      daily,
      context,
      lastCompletedIdx,
    );
    return {
      ...candidate,
      radarDurumu,
      skor:
        candidate.skor +
        teyitSayisi * 0.2 +
        (daily.resistanceBreakout ? 0.2 : 0) +
        (BIST30_SET.has(candidate.sembol) ? 0.15 : 0),
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
      ...earlyMovement,
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

  const context = buildEarlyMovementContext(hisseler);
  const confirmed = await Promise.all(
    candidates.map((candidate) => confirmCandidate(candidate, context)),
  );
  const eligible = confirmed.filter(
    (signal) => signal.teyitSayisi >= MOMENTUM_CONFIRMATIONS_REQUIRED,
  );
  const sortSignals = (a: TreydSinyali, b: TreydSinyali): number => {
    const indexPriority =
      Number(BIST30_SET.has(b.sembol)) - Number(BIST30_SET.has(a.sembol));
    return indexPriority || b.skor - a.skor;
  };
  const dailyConfirmed = eligible
    .filter((signal) => signal.radarDurumu === "gunluk_teyitli")
    .sort(sortSignals)
    .slice(0, 6);
  const intradayWatch = confirmed
    .filter(
      (signal) =>
        signal.radarDurumu === "gun_ici_izleme" &&
        signal.teyitSayisi >= INTRADAY_MIN_CONFIRMATIONS,
    )
    .sort(sortSignals)
    .slice(0, 6);
  const reservedSymbols = new Set(
    [...dailyConfirmed, ...intradayWatch].map((signal) => signal.sembol),
  );
  const earlyMovement = confirmed
    .filter(
      (signal) =>
        signal.erkenHareketSkoru >= EARLY_RADAR_MIN_SCORE &&
        !reservedSymbols.has(signal.sembol),
    )
    .sort((a, b) => {
      const scoreDifference = b.erkenHareketSkoru - a.erkenHareketSkoru;
      return scoreDifference || sortSignals(a, b);
    })
    .slice(0, 6)
    .map((signal) => ({ ...signal, radarDurumu: "erken_hareket" as const }));

  return [...dailyConfirmed, ...earlyMovement, ...intradayWatch];
};
