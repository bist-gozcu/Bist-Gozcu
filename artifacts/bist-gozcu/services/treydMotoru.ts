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
export type KararDurumu =
  | "İncelemeye değer"
  | "Kapanışı bekle"
  | "Günlük koşullar güçlü"
  | "Hızlı yükseliş — dikkat"
  | "Yeterli veri yok";
export type KararDestegi = {
  durum: KararDurumu;
  ozet: string;
  neden: string;
  risk: string;
  sonrakiAdim: string;
};

const TOTAL_CONFIRMATIONS = 6;
const MOMENTUM_CONFIRMATIONS_REQUIRED = 5;
const INTRADAY_MIN_CONFIRMATIONS = 3;
const EARLY_RADAR_MIN_SCORE = 30;
const CANDIDATE_POOL_SIZE = 12;
const MIN_AVERAGE_TURNOVER_TL = 5_000_000;
const CEKIRGE_MIN_SCORE = 35;

export type TreydSinyali = {
  sembol: string;
  fiyat: number;
  degisimYuzde: number;
  hacim: number;
  goreceliHacim: number;
  /** Kısa vadeli hareket için EMA 20 değeri. */
  ema20: number;
  /** OBV'nin son dönem yönü. */
  obvDirection: "up" | "down" | "flat";
  /** OBV'nin fiyat yönüyle uyumlu olup olmadığı. */
  obvTeyitli: boolean;
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
  /** Teknik sonucu kullanıcı diline çeviren sade karar desteği. */
  kararDestegi: KararDestegi;
  /** Yatay birikim ve olası yukarı hazırlık puanı. */
  cekirgeSkoru: number;
  /** Çekirge adayının ölçülebilir nedenleri. */
  cekirgeNedenleri: string[];
  /** Adayın temel riski. */
  cekirgeRiski: string;
  /** Ekranda Çekirge Adayı olarak gösterilip gösterilmeyeceği. */
  cekirgeUygun: boolean;
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
    ema20: NaN,
    obvDirection: "flat",
    obvTeyitli: false,
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
    kararDestegi: {
      durum: "Yeterli veri yok",
      ozet: "Hareketi değerlendirmek için yeterli günlük veri henüz yok.",
      neden: "Teknik şartlar güvenilir biçimde karşılaştırılamadı.",
      risk: "Eksik veri yanlış yönlendirebilir.",
      sonrakiAdim: "Yeni günlük veri geldikten sonra tekrar kontrol edin.",
    },
    cekirgeSkoru: 0,
    cekirgeNedenleri: ["Yatay yapı için yeterli veri yok"],
    cekirgeRiski: "Veri yetersiz; aday olarak değerlendirilmemeli.",
    cekirgeUygun: false,
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

type CekirgeAnalysis = Pick<
  TreydSinyali,
  "cekirgeSkoru" | "cekirgeNedenleri" | "cekirgeRiski" | "cekirgeUygun"
>;

const calculateCekirge = (
  chart: Awaited<ReturnType<typeof fetchChartData>>,
  daily: ReturnType<typeof analyzeDailySetup>,
  lastCompletedIdx: number,
): CekirgeAnalysis => {
  const empty: CekirgeAnalysis = {
    cekirgeSkoru: 0,
    cekirgeNedenleri: ["Yatay yapı için yeterli tarihsel veri yok"],
    cekirgeRiski: "Veri yetersiz; aday olarak değerlendirilmemeli.",
    cekirgeUygun: false,
  };
  if (!chart || lastCompletedIdx < 30) return empty;
  const start = lastCompletedIdx - 19;
  const closes = chart.closes.slice(start, lastCompletedIdx + 1);
  const volumes = chart.volumes.slice(start, lastCompletedIdx + 1);
  const validCloses = closes.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  if (validCloses.length < 15) return empty;
  const low = Math.min(...validCloses);
  const high = Math.max(...validCloses);
  const lastClose = validCloses[validCloses.length - 1];
  const rangePercent = ((high - low) / low) * 100;
  const nearSupportCount = validCloses.filter(
    (value) => value <= low * 1.03,
  ).length;
  const nearResistance = ((high - lastClose) / lastClose) * 100;
  const recentVolumes = volumes
    .slice(-5)
    .filter((value) => Number.isFinite(value) && value > 0);
  const baseVolumes = volumes.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  const recentAverageVolume = recentVolumes.length
    ? recentVolumes.reduce((sum, value) => sum + value, 0) /
      recentVolumes.length
    : 0;
  const baseAverageVolume = baseVolumes.length
    ? baseVolumes.reduce((sum, value) => sum + value, 0) / baseVolumes.length
    : 0;
  const volumeRatio =
    baseAverageVolume > 0 ? recentAverageVolume / baseAverageVolume : 0;
  const lastChange =
    validCloses.length >= 2
      ? ((lastClose - validCloses[validCloses.length - 2]) /
          validCloses[validCloses.length - 2]) *
        100
      : 0;
  const rangeScore =
    rangePercent <= 12
      ? 20
      : rangePercent <= 20
        ? 15
        : rangePercent <= 30
          ? 8
          : 0;
  const supportScore =
    nearSupportCount >= 3
      ? 15
      : nearSupportCount >= 2
        ? 10
        : nearSupportCount >= 1
          ? 4
          : 0;
  const volumeScore =
    volumeRatio > 0 && volumeRatio <= 0.85 ? 10 : volumeRatio <= 1.1 ? 6 : 0;
  const resistanceScore =
    nearResistance <= 3
      ? 15
      : nearResistance <= 6
        ? 10
        : nearResistance <= 10
          ? 5
          : 0;
  const directionScore =
    daily.dailyTrend === "down" ? 0 : lastChange >= 0 ? 10 : 4;
  const obvScore = daily.obvDirection === "up" && daily.obvAlignedWithPrice ? 8 : 0;
  const score = clamp(
    rangeScore + supportScore + volumeScore + resistanceScore + directionScore + obvScore,
    0,
    100,
  );
  const reasons = [
    `20 günlük bant genişliği %${rangePercent.toFixed(1)}`,
    `${nearSupportCount} kez alt banda yakın kapanış`,
    `Son 5 gün hacmi ortalamanın ${volumeRatio > 0 ? `${volumeRatio.toFixed(2)} katı` : "hesaplanamadı"}`,
    `Üst banda/dirence mesafe %${nearResistance.toFixed(1)}`,
    `Günlük yön: ${daily.dailyTrend === "down" ? "aşağı" : daily.dailyTrend === "up" ? "yukarı" : "yatay"}`,
    `${obvScore > 0 ? "✓" : "—"} OBV yönü: ${daily.obvDirection === "up" ? "yukarı ve fiyatla uyumlu" : daily.obvDirection === "down" ? "aşağı" : "yatay"}`,
  ];
  const risk =
    daily.dailyTrend === "down"
      ? "Günlük yön aşağı; yatay yapı bozulmuş olabilir."
      : nearResistance > 6
        ? "Direnç uzak; yataylık uzun sürebilir."
        : volumeRatio > 1.25
          ? "Hacim artışı henüz istikrarlı değil; kırılım teyidi beklenmeli."
          : "Direnç kırılmadı; aday yükseliş garantisi taşımaz.";
  return {
    cekirgeSkoru: score,
    cekirgeNedenleri: reasons,
    cekirgeRiski: risk,
    cekirgeUygun:
      score >= CEKIRGE_MIN_SCORE &&
      daily.dailyTrend !== "down" &&
      rangePercent <= 30 &&
      baseAverageVolume > 0,
  };
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

  const shortTrendScore =
    Number.isFinite(daily.ema20) &&
    completedClose > daily.ema20 &&
    daily.ema20AboveSma50
      ? 5
      : 0;
  const obvScore =
    daily.obvDirection === "up" && daily.obvAlignedWithPrice ? 5 : 0;

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
        shortTrendScore +
        obvScore +
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
    `${shortTrendScore > 0 ? "✓" : "—"} EMA 20: ${Number.isFinite(daily.ema20) ? (completedClose > daily.ema20 ? "fiyat üzerinde" : "fiyat altında") : "hesaplanamadı"}`,
    `${obvScore > 0 ? "✓" : "—"} OBV: ${daily.obvDirection === "up" ? "yukarı yönlü" : daily.obvDirection === "down" ? "zayıf" : "yatay"}`,
    `${marketBreadthScore + sectorBreadthScore >= 8 ? "✓" : "—"} Genişlik: BIST ${Math.round(context.marketPositiveRatio * 100)}% pozitif${sectorSnapshot ? ` · sektör ${Math.round(sectorSnapshot.positiveRatio * 100)}%` : ""}`,
  ];

  return {
    erkenHareketSkoru: score,
    erkenHareketEtiketi: label,
    erkenHareketNedenleri: reasons,
    piyasaHavasi,
  };
};

/** Teknik sonuçları kullanıcının karar sırasına uygun sade bir özete çevirir. */
const buildDecisionSupport = (
  candidate: TreydSinyali,
  daily: ReturnType<typeof analyzeDailySetup>,
  context: EarlyMovementContext,
  earlyMovement: Pick<TreydSinyali, "erkenHareketSkoru" | "piyasaHavasi">,
  opening: ReturnType<typeof analyzeOpeningBehavior>,
  teyitSayisi: number,
): KararDestegi => {
  const dailyConfirmed = teyitSayisi >= MOMENTUM_CONFIRMATIONS_REQUIRED;
  const rapidMove =
    candidate.degisimYuzde >= 5 || earlyMovement.erkenHareketSkoru >= 50;
  const marketRelative = candidate.degisimYuzde - context.marketMedianChange;
  const sector = getStockMeta(candidate.sembol)?.sector;
  const sectorSnapshot = sector ? context.sectors.get(sector) : undefined;
  const sectorRelative =
    candidate.degisimYuzde -
    (sectorSnapshot?.medianChange ?? context.marketMedianChange);
  const resistanceDistance =
    Number.isFinite(daily.resistance) && daily.resistance > 0
      ? ((daily.resistance - candidate.fiyat) / candidate.fiyat) * 100
      : null;

  const durum: KararDurumu = dailyConfirmed
    ? "Günlük koşullar güçlü"
    : rapidMove
      ? "Hızlı yükseliş — dikkat"
      : teyitSayisi >= INTRADAY_MIN_CONFIRMATIONS
        ? "Kapanışı bekle"
        : earlyMovement.erkenHareketSkoru >= EARLY_RADAR_MIN_SCORE
          ? "İncelemeye değer"
          : "Yeterli veri yok";

  const nedenler: string[] = [];
  if (earlyMovement.erkenHareketSkoru >= EARLY_RADAR_MIN_SCORE)
    nedenler.push(`Erken hareket skoru ${earlyMovement.erkenHareketSkoru}/100`);
  if (daily.volumeConfirmed || daily.relativeVolume >= 1.2)
    nedenler.push(
      `Hacim normalin ${daily.relativeVolume.toFixed(2)} katı seviyesinde`,
    );
  if (daily.resistanceBreakout)
    nedenler.push("Fiyat direnç üzerinde kapanış yaptı");
  if (marketRelative >= 1.5)
    nedenler.push("Genel piyasaya göre daha güçlü hareket ediyor");
  if (sectorRelative >= 1.5)
    nedenler.push("Kendi sektörüne göre daha güçlü hareket ediyor");
  if (opening && opening.recentUpDays > opening.recentDownDays)
    nedenler.push(`Son 5 açılışın ${opening.recentUpDays} tanesi yukarı yönlü`);
  if (nedenler.length === 0)
    nedenler.push("Yeterli olumlu öncü işaret oluşmadı");

  const riskler: string[] = [];
  if (rapidMove)
    riskler.push(
      "Hareket hızlı; fiyatı sonradan kovalamak geri çekilme riski taşır",
    );
  if (!daily.resistanceBreakout)
    riskler.push("Direnç üzerinde kalıcılık henüz doğrulanmadı");
  if (!daily.volumeConfirmed)
    riskler.push("Hacim günlük trend için henüz tam teyit vermiyor");
  if (earlyMovement.piyasaHavasi === "Piyasa desteği zayıf")
    riskler.push("Genel piyasa desteği sınırlı");
  if (riskler.length === 0)
    riskler.push(
      "Teknik göstergeler geleceği garanti etmez; yeni kapanış izlenmeli",
    );

  const sonrakiAdim = dailyConfirmed
    ? "Bir sonraki kapanışta trendin ve hacmin korunup korunmadığını kontrol edin."
    : daily.resistanceBreakout
      ? "Yeni kapanışta direnç üzerindeki kalıcılığı ve hacmin devamını kontrol edin."
      : "Kapanışta teyit sayısını, direnç seviyesini ve hacmin devamını kontrol edin.";

  return {
    durum,
    ozet: dailyConfirmed
      ? "Günlük şartların çoğu tamamlandı; hareketin bir kısmı gerçekleşmiş olabilir."
      : rapidMove
        ? "Fiyat hareketi hızlandı; günlük trend henüz tam doğrulanmış değil."
        : "Bazı olumlu işaretler oluşuyor; gün sonu kapanışı sonucu değiştirebilir.",
    neden: nedenler.slice(0, 3).join(" · "),
    risk: riskler.slice(0, 2).join(" · "),
    sonrakiAdim,
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
    const ema20Confirmed =
      Number.isFinite(daily.ema20) &&
      Number.isFinite(daily.resistance) &&
      chart.closes[lastCompletedIdx] > daily.ema20;
    const obvConfirmed =
      daily.obvDirection === "up" && daily.obvAlignedWithPrice;
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
    teyitler.push(
      `${ema20Confirmed ? "✓" : "—"} Kısa vadeli EMA 20: ${ema20Confirmed ? "fiyat üzerinde" : "teyit yok"}`,
    );
    teyitler.push(
      `${obvConfirmed ? "✓" : "—"} OBV: ${obvConfirmed ? "fiyatla uyumlu yükseliyor" : "ek hacim teyidi yok"}`,
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
    const cekirge = calculateCekirge(chart, daily, lastCompletedIdx);
    const opening = analyzeOpeningBehavior(chart.opens, chart.closes, 50);
    const kararDestegi = buildDecisionSupport(
      candidate,
      daily,
      context,
      earlyMovement,
      opening,
      teyitSayisi,
    );
    return {
      ...candidate,
      radarDurumu,
      ema20: daily.ema20,
      obvDirection: daily.obvDirection,
      obvTeyitli: obvConfirmed,
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
      ...cekirge,
      kararDestegi,
    };
  } catch {
    return {
      ...candidate,
      etiket: "TAKİP LİSTESİ",
      teyitler: ["— Tarihsel veri alınamadı; güvenli modda gösteriliyor"],
      cekirgeSkoru: 0,
      cekirgeNedenleri: ["Yatay yapı verisi alınamadı"],
      cekirgeRiski: "Tarihsel veri alınamadı; aday olarak değerlendirilmemeli.",
      cekirgeUygun: false,
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

  const selectedBase = [...dailyConfirmed, ...earlyMovement, ...intradayWatch];
  const selectedSymbols = new Set(selectedBase.map((signal) => signal.sembol));
  const cekirgeCandidates = confirmed
    .filter(
      (signal) => signal.cekirgeUygun && !selectedSymbols.has(signal.sembol),
    )
    .sort((a, b) => b.cekirgeSkoru - a.cekirgeSkoru || sortSignals(a, b))
    .slice(0, 6);

  return [...selectedBase, ...cekirgeCandidates];
};
