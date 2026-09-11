import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  useDerivedValue,
} from "react-native-reanimated";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Line,
  Text as SvgText,
  Circle,
  ClipPath,
  G,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { ChartRange } from "@/utils/yahooFinance";

export type ChartType = "line" | "candle";
export type ChartOverlay = { label: string; values: number[]; color: string };

interface PriceChartProps {
  closes: number[];
  opens?: number[];
  highs?: number[];
  lows?: number[];
  volumes: number[];
  timestamps: number[];
  range: ChartRange;
  chartType?: ChartType;
  height?: number;
  overlays?: ChartOverlay[];
  previousClose?: number;
}

/* ─── Layout constants ─── */
const ML = 4; // left margin (y-axis labels outside SVG via RN)
const MR = 56; // right margin (price labels inside SVG)
const MT = 8;
const MB = 20;
const VOL_GAP = 4;
const SESSION_START_HOUR = 10;
const SESSION_END_HOUR = 18;
const SESSION_END_MINUTE = 10;

type Point = {
  idx: number;
  c: number;
  o: number;
  h: number;
  l: number;
  v: number;
  t: number;
};
type Candle = {
  x: number;
  openY: number;
  closeY: number;
  highY: number;
  lowY: number;
  color: string;
  bodyColor: string;
  width: number;
};
type Label = { x: number; label: string };

function formatDate(ts: number, range: ChartRange): string {
  const d = new Date(ts * 1000);
  if (range === "1d")
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (range === "5d")
    return d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" });
  if (range === "5y" || range === "1y")
    return d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function formatPrice(p: number): string {
  if (p >= 10000) return `${(p / 1000).toFixed(0)}K`;
  if (p >= 1000) return `${(p / 1000).toFixed(1)}K`;
  if (p >= 100) return p.toFixed(0);
  if (p >= 10) return p.toFixed(1);
  return p.toFixed(2);
}

function localSessionBounds(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const start = new Date(date);
  start.setHours(SESSION_START_HOUR, 0, 0, 0);
  const end = new Date(date);
  end.setHours(SESSION_END_HOUR, SESSION_END_MINUTE, 0, 0);
  return {
    start: start.getTime() / 1000,
    end: end.getTime() / 1000,
  };
}

/* ═══════════════════════════════════════════════════════
   Professional Price Chart — Midas / TradingView style
   ═══════════════════════════════════════════════════════ */
export default function PriceChart({
  closes,
  opens,
  highs,
  lows,
  volumes,
  timestamps,
  range,
  chartType = "line",
  height: chartHeight = 220,
  overlays = [],
  previousClose,
}: PriceChartProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const chartW = Math.max(180, width - ML - MR);
  const volH = chartHeight >= 300 ? 52 : 40;
  const priceH = chartHeight - volH - VOL_GAP;

  // ── Crosshair state ──
  const [crosshair, setCrosshair] = useState<{
    x: number;
    y: number;
    price: number;
    time: string;
    idx: number;
  } | null>(null);

  /* ── Process data ── */
  const {
    valid,
    candles,
    overlayPaths,
    baselineY,
    baselineLabel,
    volBars,
    xLabels,
    yLabels,
    prevCloseY,
    lastPriceLineY,
    lastPriceLabel,
    mapXT,
    mapXP,
  } = useMemo(() => {
    const raw = closes
      .map((c, i) => {
        const open = opens?.[i] != null && opens[i] > 0 ? opens[i] : c;
        const high =
          highs?.[i] != null && highs[i] > 0
            ? highs[i]
            : Math.max(open, c);
        const low =
          lows?.[i] != null && lows[i] > 0 ? lows[i] : Math.min(open, c);
        return {
          idx: i,
          c,
          o: open,
          h: Math.max(high, open, c),
          l: Math.min(low, open, c),
          v: volumes[i] ?? 0,
          t: timestamps[i] ?? 0,
        };
      })
      .filter((d) => d.c > 0 && d.t > 0);

    if (raw.length < 2)
      return {
        valid: [] as Point[],
        candles: [] as Candle[],
        overlayPaths: [] as { label: string; d: string; color: string }[],
        baselineY: 0,
        baselineLabel: "",
        volBars: [] as { x: number; h: number; w: number; color: string }[],
        xLabels: [] as Label[],
        yLabels: [] as { y: number; label: string }[],
        prevCloseY: null as number | null,
        lastPriceLineY: null as number | null,
        lastPriceLabel: "",
        mapXT: (_t: number) => ML,
        mapXP: (_p: number) => MT,
      };

    const session =
      range === "1d"
        ? localSessionBounds(raw[raw.length - 1].t)
        : null;

    const x = (i: number): number => {
      if (!session || range !== "1d")
        return ML + (i / (raw.length - 1)) * chartW;
      const ratio = Math.max(
        0,
        Math.min(
          1,
          (raw[i].t - session.start) / (session.end - session.start),
        ),
      );
      return ML + ratio * chartW;
    };
    const mapXT = (t: number): number => {
      if (!session || range !== "1d") return ML;
      const ratio = Math.max(
        0,
        Math.min(
          1,
          (t - session.start) / (session.end - session.start),
        ),
      );
      return ML + ratio * chartW;
    };

    const minP = Math.min(...raw.map((d) => d.l));
    const maxP = Math.max(...raw.map((d) => d.h));
    // Expand range slightly for aesthetics
    const pad = (maxP - minP) * 0.05 || 0.5;
    const pMin = minP - pad;
    const pMax = maxP + pad;
    const pRange = pMax - pMin || 1;

    const y = (p: number): number =>
      MT + priceH * (1 - (p - pMin) / pRange);
    const mapXP = (p: number): number => y(p);

    const firstPrice = raw[0].c;
    const lastPrice = raw[raw.length - 1].c;

    // ── Candles ──
    const candleWidth = Math.max(
      2,
      Math.min(8, (chartW / raw.length) * 0.65),
    );
    const candleData: Candle[] = raw.map((d, i) => ({
      x: x(i),
      openY: y(d.o),
      closeY: y(d.c),
      highY: y(d.h),
      lowY: y(d.l),
      color: d.c >= d.o ? colors.up : colors.down,
      bodyColor:
        d.c >= d.o
          ? colors.up
          : colors.down,
      width: candleWidth,
    }));

    // ── Overlays ──
    const overlayPaths = overlays
      .map((overlay) => {
        const pts = raw
          .map((item, i) => ({ x: x(i), value: overlay.values[item.idx] }))
          .filter((p) => Number.isFinite(p.value));
        const d = pts
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${y(p.value).toFixed(1)}`,
          )
          .join(" ");
        return { label: overlay.label, d, color: overlay.color };
      })
      .filter((o) => o.d.length > 0);

    // ── Volume ──
    const maxVol = Math.max(...raw.map((d) => d.v), 1);
    const barW = Math.max(1, chartW / Math.max(raw.length, 1) - 1);
    const volBars = raw.map((d, i) => ({
      x: x(i) - barW / 2,
      h: (d.v / maxVol) * volH,
      w: barW,
      color:
        i === 0 || raw[i].c >= raw[i - 1].c ? colors.up : colors.down,
    }));

    // ── X labels ──
    const xLabels: Label[] =
      range === "1d" && session
        ? [
            { timestamp: session.start, label: "10:00" },
            {
              timestamp:
                new Date(session.start * 1000).setHours(12, 0, 0, 0) / 1000,
              label: "12:00",
            },
            {
              timestamp:
                new Date(session.start * 1000).setHours(14, 0, 0, 0) / 1000,
              label: "14:00",
            },
            {
              timestamp:
                new Date(session.start * 1000).setHours(16, 0, 0, 0) / 1000,
              label: "16:00",
            },
            { timestamp: session.end, label: "18:10" },
          ]
            .map((item) => ({
              x: mapXT(item.timestamp),
              label: item.label,
            }))
            .filter(
              (item) => item.x >= ML && item.x <= ML + chartW,
            )
        : (() => {
          const tickCount = Math.min(5, raw.length);
          const step = Math.max(
            1,
            Math.floor((raw.length - 1) / Math.max(1, tickCount - 1)),
          );
          return Array.from({ length: tickCount }, (_, i) => {
            const idx = Math.min(i * step, raw.length - 1);
            return { x: x(idx), label: formatDate(raw[idx].t, range) };
          });
        })();

    // ── Y labels ──
    const yLabels = Array.from({ length: 5 }, (_, i) => {
      const p = pMin + (pRange * i) / 4;
      return { y: y(p), label: formatPrice(p) };
    });

    // ── Previous close / opening reference line ──
    const pc = previousClose ?? (raw.length > 1 ? raw[0].o : null);
    const prevCloseY = pc != null && pc > 0 ? y(pc) : null;

    // ── Last price line ──
    const lastPriceLineY = y(lastPrice);
    const lastPriceLabel = `₺${lastPrice.toFixed(2)}`;

    return {
      valid: raw,
      candles: candleData,
      overlayPaths,
      baselineY: prevCloseY ?? y(firstPrice),
      baselineLabel:
        prevCloseY != null
          ? `Açılış ₺${(pc! / 100).toFixed(2)}`
          : `Başlangıç ${formatPrice(firstPrice)}`,
      volBars,
      xLabels,
      yLabels,
      prevCloseY,
      lastPriceLineY,
      lastPriceLabel,
      mapXT,
      mapXP,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    closes,
    opens,
    highs,
    lows,
    volumes,
    timestamps,
    range,
    chartType,
    chartHeight,
    chartW,
    priceH,
    volH,
    overlays,
    colors,
    previousClose,
  ]);

  /* ── Crosshair gesture ── */
  const onCrosshairMove = useCallback(
    (px: number) => {
      if (valid.length < 2) {
        setCrosshair(null);
        return;
      }
      const chartLeft = ML;
      const ratio = Math.max(0, Math.min(1, (px - chartLeft) / chartW));
      // Find nearest data point
      const session =
        range === "1d"
          ? localSessionBounds(valid[valid.length - 1].t)
          : null;
      let nearestIdx = 0;
      if (session && range === "1d") {
        const t = session.start + ratio * (session.end - session.start);
        let minDist = Infinity;
        valid.forEach((d, i) => {
          const dist = Math.abs(d.t - t);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        });
      } else {
        nearestIdx = Math.round(ratio * (valid.length - 1));
      }
      nearestIdx = Math.max(0, Math.min(valid.length - 1, nearestIdx));
      const d = valid[nearestIdx];

      const session2 =
        range === "1d"
          ? localSessionBounds(valid[valid.length - 1].t)
          : null;
      let dataX: number;
      if (session2 && range === "1d") {
        const r = Math.max(
          0,
          Math.min(
            1,
            (d.t - session2.start) / (session2.end - session2.start),
          ),
        );
        dataX = ML + r * chartW;
      } else {
        dataX = ML + (nearestIdx / (valid.length - 1)) * chartW;
      }

      setCrosshair({
        x: dataX,
        y: mapXP(d.c),
        price: d.c,
        time: formatDate(d.t, range),
        idx: nearestIdx,
      });
    },
    [valid, range, chartW, mapXP],
  );

  const onCrosshairEnd = useCallback(() => {
    setCrosshair(null);
  }, []);

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      runOnJS(onCrosshairMove)(e.x);
    })
    .onUpdate((e) => {
      runOnJS(onCrosshairMove)(e.x);
    })
    .onEnd(() => {
      runOnJS(onCrosshairEnd)();
    })
    .activeOffsetX([-10, 10])
    .activeOffsetY([-10, 10])


  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      runOnJS(onCrosshairMove)(e.x);
    })
    .maxDeltaX(20)
    .maxDeltaY(20);

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  /* ── Empty state ── */
  if (closes.filter((c) => c > 0).length < 2) {
    return (
      <View style={[styles.empty, { height: chartHeight + MB }]}>
        <Text
          style={{ color: colors.mutedForeground, fontSize: 12 }}
        >
          Grafik verisi yükleniyor...
        </Text>
      </View>
    );
  }

  const totalH = chartHeight + MB;

  /* ── Crosshair info labels ── */
  const crosshairPriceLabel = crosshair
    ? `₺${crosshair.price.toFixed(2)}`
    : null;
  const crosshairTimeLabel = crosshair?.time ?? null;
  // OHLCV for crosshair tooltip
  const crosshairOHLCV = crosshair && valid.length > 0 ? valid[crosshair.idx] : null;

  return (
    <GestureHandlerRootView style={{ height: totalH }}>
      <GestureDetector gesture={composedGesture}>
        <View style={{ flex: 1 }}>
          {/* ── Y-axis price labels (RN Text outside SVG for clarity) ── */}
          <View style={[styles.yAxisLabels, { left: 0, top: MT, height: priceH }]}>
            {yLabels.map((lbl, i) => (
              <Text
                key={`yl-${i}`}
                style={{
                  position: "absolute",
                  top: lbl.y - MT - 5,
                  fontSize: 9,
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                  width: ML - 2,
                  textAlign: "right",
                }}
              >
                {lbl.label}
              </Text>
            ))}
          </View>

          <Svg width={width - ML} height={totalH}>
            <Defs>
              <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={
                    valid.length > 1 &&
                    valid[valid.length - 1].c >= valid[0].c
                      ? colors.up
                      : colors.down
                  }
                  stopOpacity="0.12"
                />
                <Stop
                  offset="1"
                  stopColor="transparent"
                  stopOpacity="0"
                />
              </LinearGradient>
            </Defs>

            {/* ── Horizontal grid lines ── */}
            {yLabels.map((lbl, i) => (
              <Line
                key={`grid-${i}`}
                x1={ML}
                y1={lbl.y}
                x2={ML + chartW}
                y2={lbl.y}
                stroke={colors.border}
                strokeWidth={0.5}
                strokeDasharray="2,4"
                opacity={0.6}
              />
            ))}

            {/* ── Opening / Previous close reference line ── */}
            {prevCloseY != null && (
              <G>
                <Line
                  x1={ML}
                  y1={prevCloseY}
                  x2={ML + chartW}
                  y2={prevCloseY}
                  stroke={colors.mutedForeground}
                  strokeWidth={0.8}
                  strokeDasharray="4,4"
                  opacity={0.7}
                />
                <SvgText
                  x={ML + 4}
                  y={prevCloseY - 4}
                  fontSize={8}
                  fontFamily="Inter_500Medium"
                  fill={colors.mutedForeground}
                >
                  {`Açılış ${previousClose != null ? "₺" + previousClose.toFixed(2) : ""}`}
                </SvgText>
              </G>
            )}

            {/* ── Candlestick or Line chart ── */}
            {chartType === "line" ? (
              (() => {
                if (valid.length < 2) return null;
                const pts = valid.map((d, i) => {
                  const xv =
                    range === "1d" && localSessionBounds(valid[valid.length - 1].t)
                      ? ML +
                        Math.max(
                          0,
                          Math.min(
                            1,
                            (d.t -
                              localSessionBounds(valid[valid.length - 1].t)
                                .start) /
                              (localSessionBounds(valid[valid.length - 1].t).end -
                                localSessionBounds(valid[valid.length - 1].t)
                                  .start),
                          ),
                        ) *
                          chartW
                      : ML + (i / (valid.length - 1)) * chartW;
                  return { x: xv, y: mapXP(d.c), c: d.c };
                });
                const pathLine = pts
                  .map(
                    (p, i) =>
                      `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
                  )
                  .join(" ");
                const pathFill = `${pathLine} L${pts[pts.length - 1].x.toFixed(1)},${(MT + priceH).toFixed(1)} L${pts[0].x.toFixed(1)},${(MT + priceH).toFixed(1)} Z`;
                // Build colored segments
                const segments = pts.slice(1).map((point, i) => ({
                  d: `M${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} L${point.x.toFixed(1)},${point.y.toFixed(1)}`,
                  color: point.c >= pts[i].c ? colors.up : colors.down,
                }));
                return (
                  <G>
                    <Path d={pathFill} fill="url(#areaGrad)" />
                    {segments.map((seg, i) => (
                      <Path
                        key={`seg-${i}`}
                        d={seg.d}
                        stroke={seg.color}
                        strokeWidth={1.6}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </G>
                );
              })()
            ) : (
              candles.map((candle, i) => (
                <G key={`c-${i}`}>
                  {/* Wick / shadow */}
                  <Line
                    x1={candle.x}
                    y1={candle.highY}
                    x2={candle.x}
                    y2={candle.lowY}
                    stroke={candle.color}
                    strokeWidth={1}
                  />
                  {/* Body */}
                  <Rect
                    x={candle.x - candle.width / 2}
                    y={Math.min(candle.openY, candle.closeY)}
                    width={candle.width}
                    height={Math.max(
                      1.2,
                      Math.abs(candle.closeY - candle.openY),
                    )}
                    fill={candle.bodyColor}
                    rx={0.5}
                  />
                </G>
              ))
            )}

            {/* ── Overlay indicator lines ── */}
            {overlayPaths.map((overlay) => (
              <Path
                key={`ov-${overlay.label}`}
                d={overlay.d}
                stroke={overlay.color}
                strokeWidth={1.2}
                fill="none"
                opacity={0.85}
                strokeLinejoin="round"
              />
            ))}

            {/* ── Last price horizontal line ── */}
            {lastPriceLineY != null && valid.length > 0 && (
              <G>
                <Line
                  x1={ML}
                  y1={lastPriceLineY}
                  x2={ML + chartW}
                  y2={lastPriceLineY}
                  stroke={
                    valid[valid.length - 1].c >= valid[0].c
                      ? colors.up
                      : colors.down
                  }
                  strokeWidth={0.7}
                  strokeDasharray="3,3"
                  opacity={0.7}
                />
                {/* Price tag on right */}
                <Rect
                  x={ML + chartW + 2}
                  y={lastPriceLineY - 9}
                  width={MR - 8}
                  height={18}
                  rx={4}
                  fill={
                    valid[valid.length - 1].c >= valid[0].c
                      ? colors.up
                      : colors.down
                  }
                />
                <SvgText
                  x={ML + chartW + MR / 2 - 1}
                  y={lastPriceLineY + 3}
                  fontSize={9}
                  fontFamily="Inter_600SemiBold"
                  fill="#fff"
                  textAnchor="middle"
                >
                  {lastPriceLabel}
                </SvgText>
              </G>
            )}

            {/* ── Volume bars ── */}
            {volBars.map((bar, i) => (
              <Rect
                key={`v-${i}`}
                x={bar.x}
                y={MT + priceH + VOL_GAP + (volH - bar.h)}
                width={bar.w}
                height={bar.h}
                fill={bar.color}
                opacity={0.25}
                rx={0.5}
              />
            ))}

            {/* ── X-axis time labels ── */}
            {xLabels.map((lbl, i) => (
              <SvgText
                key={`xl-${i}`}
                x={lbl.x}
                y={totalH - 4}
                fontSize={9}
                fontFamily="Inter_400Regular"
                fill={colors.mutedForeground}
                textAnchor="middle"
              >
                {lbl.label}
              </SvgText>
            ))}

            {/* ── Crosshair ── */}
            {crosshair && (
              <G>
                {/* Vertical line */}
                <Line
                  x1={crosshair.x}
                  y1={MT}
                  x2={crosshair.x}
                  y2={MT + priceH + VOL_GAP + volH}
                  stroke={colors.mutedForeground}
                  strokeWidth={0.7}
                  strokeDasharray="3,3"
                  opacity={0.6}
                />
                {/* Horizontal line */}
                <Line
                  x1={ML}
                  y1={crosshair.y}
                  x2={ML + chartW}
                  y2={crosshair.y}
                  stroke={colors.mutedForeground}
                  strokeWidth={0.7}
                  strokeDasharray="3,3"
                  opacity={0.6}
                />
                {/* Dot on price */}
                <Circle
                  cx={crosshair.x}
                  cy={crosshair.y}
                  r={3}
                  fill={
                    crosshairOHLCV &&
                    crosshairOHLCV.c >= crosshairOHLCV.o
                      ? colors.up
                      : colors.down
                  }
                  stroke="#fff"
                  strokeWidth={1}
                />
              </G>
            )}
          </Svg>

          {/* ── Crosshair info tooltip (RN overlay) ── */}
          {crosshair && crosshairOHLCV && (
            <View
              style={[
                styles.crosshairTooltip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  top: 2,
                  right: MR + 4,
                },
              ]}
            >
              <Text
                style={[
                  styles.tooltipRow,
                  { color: colors.mutedForeground },
                ]}
              >
                {crosshair.time}
              </Text>
              <View style={styles.tooltipGrid}>
                <Text
                  style={[
                    styles.tooltipLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Aç
                </Text>
                <Text
                  style={[
                    styles.tooltipVal,
                    { color: colors.foreground },
                  ]}
                >
                  ₺{crosshairOHLCV.o.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.tooltipLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Yük
                </Text>
                <Text
                  style={[
                    styles.tooltipVal,
                    { color: colors.foreground },
                  ]}
                >
                  ₺{crosshairOHLCV.h.toFixed(2)}
                </Text>
              </View>
              <View style={styles.tooltipGrid}>
                <Text
                  style={[
                    styles.tooltipLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Kap
                </Text>
                <Text
                  style={[
                    styles.tooltipVal,
                    {
                      color:
                        crosshairOHLCV.c >= crosshairOHLCV.o
                          ? colors.up
                          : colors.down,
                    },
                  ]}
                >
                  ₺{crosshairOHLCV.c.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.tooltipLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Düş
                </Text>
                <Text
                  style={[
                    styles.tooltipVal,
                    { color: colors.foreground },
                  ]}
                >
                  ₺{crosshairOHLCV.l.toFixed(2)}
                </Text>
              </View>
              <View style={styles.tooltipGrid}>
                <Text
                  style={[
                    styles.tooltipLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Hac
                </Text>
                <Text
                  style={[
                    styles.tooltipVal,
                    { color: colors.foreground },
                  ]}
                >
                  {(
                    (crosshairOHLCV.v / 1000).toFixed(0) + "K"
                  )}
                </Text>
              </View>
            </View>
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center" },
  yAxisLabels: {
    position: "absolute",
  },
  crosshairTooltip: {
    position: "absolute",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipRow: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    marginBottom: 3,
  },
  tooltipGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 1,
  },
  tooltipLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    width: 24,
  },
  tooltipVal: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
});
