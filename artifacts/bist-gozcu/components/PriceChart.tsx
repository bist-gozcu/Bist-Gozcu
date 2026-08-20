import React, { useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Line,
  Text as SvgText,
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
}

const CHART_H = 200;
const VOL_H = 36;
const ML = 52;
const MR = 8;
const MT = 10;
const MB = 22;
const SESSION_START_HOUR = 10;
const SESSION_END_HOUR = 18;
const SESSION_END_MINUTE = 10;

type Point = { idx: number; c: number; o: number; h: number; l: number; v: number; t: number; x: number; y: number };
type LineSegment = { d: string; color: string };
type Candle = { x: number; openY: number; closeY: number; highY: number; lowY: number; color: string; width: number };

type Label = { x: number; label: string };

function formatDate(ts: number, range: ChartRange): string {
  const d = new Date(ts * 1000);
  if (range === "1d") return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (range === "5d") return d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" });
  if (range === "5y" || range === "1y") return d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function formatPrice(p: number): string {
  if (p >= 10000) return `${(p / 1000).toFixed(0)}K`;
  if (p >= 1000) return `${(p / 1000).toFixed(1)}K`;
  if (p >= 100) return p.toFixed(0);
  if (p >= 10) return p.toFixed(1);
  return p.toFixed(2);
}

function localSessionBounds(timestamp: number): { start: number; end: number } {
  const date = new Date(timestamp * 1000);
  const start = new Date(date);
  start.setHours(SESSION_START_HOUR, 0, 0, 0);
  const end = new Date(date);
  end.setHours(SESSION_END_HOUR, SESSION_END_MINUTE, 0, 0);
  return { start: start.getTime() / 1000, end: end.getTime() / 1000 };
}

export default function PriceChart({
  closes,
  opens,
  highs,
  lows,
  volumes,
  timestamps,
  range,
  chartType = "line",
  height: chartHeight = 200,
  overlays = [],
}: PriceChartProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const chartW = Math.max(180, width - ML - MR);
  const volH = chartHeight >= 300 ? 48 : VOL_H;
  const priceH = chartHeight - volH - 6;

  const {
    pathFill,
    lineSegments,
    candles,
    baselineY,
    baselineLabel,
    baselineColor,
    volBars,
    xLabels,
    yLabels,
    overlayPaths,
  } = useMemo(() => {
    const valid = closes
      .map((c, i) => {
        const open = opens?.[i] != null && opens[i] > 0 ? opens[i] : c;
        const high = highs?.[i] != null && highs[i] > 0 ? highs[i] : Math.max(open, c);
        const low = lows?.[i] != null && lows[i] > 0 ? lows[i] : Math.min(open, c);
        return { idx: i, c, o: open, h: Math.max(high, open, c), l: Math.min(low, open, c), v: volumes[i] ?? 0, t: timestamps[i] ?? 0 };
      })
      .filter((d) => d.c > 0 && d.t > 0);

    if (valid.length < 2) {
      return {
        pathFill: "",
        lineSegments: [] as LineSegment[],
        overlayPaths: [] as { label: string; d: string; color: string }[],
        candles: [] as Candle[],
        baselineY: 0,
        baselineLabel: "Başlangıç",
        baselineColor: colors.mutedForeground,
        volBars: [] as { x: number; h: number; w: number; color: string }[],
        xLabels: [] as Label[],
        yLabels: [] as { y: number; label: string }[],
      };
    }

    const cs = valid.map((d) => d.c);
    const vs = valid.map((d) => d.v);
    const ts = valid.map((d) => d.t);
    const minP = Math.min(...valid.map((d) => d.l));
    const maxP = Math.max(...valid.map((d) => d.h));
    const pRange = maxP - minP || 1;
    const firstPrice = cs[0];
    const lastPrice = cs[cs.length - 1];
    const overallColor = lastPrice >= firstPrice ? colors.up : colors.down;
    const session = range === "1d" ? localSessionBounds(ts[ts.length - 1]) : null;

    const x = (i: number): number => {
      if (!session || range !== "1d") return ML + (i / (valid.length - 1)) * chartW;
      const ratio = Math.max(0, Math.min(1, (valid[i].t - session.start) / (session.end - session.start)));
      return ML + ratio * chartW;
    };
    const xForTimestamp = (timestamp: number): number => {
      if (!session || range !== "1d") return ML;
      const ratio = Math.max(0, Math.min(1, (timestamp - session.start) / (session.end - session.start)));
      return ML + ratio * chartW;
    };
    const y = (p: number): number => MT + priceH * (1 - (p - minP) / pRange);
    const pts: Point[] = valid.map((d, i) => ({ ...d, x: x(i), y: y(d.c) }));
    const pathLine = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const pathFill = `${pathLine} L${pts[pts.length - 1].x.toFixed(1)},${(MT + priceH).toFixed(1)} L${pts[0].x.toFixed(1)},${(MT + priceH).toFixed(1)} Z`;
    const lineSegments: LineSegment[] = pts.slice(1).map((point, i) => ({
      d: `M${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} L${point.x.toFixed(1)},${point.y.toFixed(1)}`,
      color: point.c >= pts[i].c ? colors.up : colors.down,
    }));
    const overlayPaths = overlays.map((overlay) => {
      const overlayPoints = valid
        .map((item, i) => ({ x: pts[i].x, value: overlay.values[item.idx] }))
        .filter((item) => Number.isFinite(item.value));
      const d = overlayPoints.map((point, i) => `${i === 0 ? "M" : "L"}${point.x.toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
      return { label: overlay.label, d, color: overlay.color };
    }).filter((overlay) => overlay.d.length > 0);
    const candleWidth = Math.max(3, Math.min(10, (chartW / valid.length) * 0.68));
    const candles: Candle[] = pts.map((point, i) => ({
      x: point.x,
      openY: y(valid[i].o),
      closeY: y(valid[i].c),
      highY: y(valid[i].h),
      lowY: y(valid[i].l),
      color: valid[i].c >= valid[i].o ? colors.up : colors.down,
      width: candleWidth,
    }));

    const maxVol = Math.max(...vs, 1);
    const barW = Math.max(1, chartW / Math.max(valid.length, 1) - 1);
    const volBars = vs.map((v, i) => ({
      x: x(i) - barW / 2,
      h: (v / maxVol) * volH,
      w: barW,
      color: i === 0 || valid[i].c >= valid[i - 1].c ? colors.up : colors.down,
    }));

    const xLabels = range === "1d" && session
      ? [
          { timestamp: session.start, label: "10:00" },
          { timestamp: new Date(session.start * 1000).setHours(13, 0, 0, 0) / 1000, label: "13:00" },
          { timestamp: new Date(session.start * 1000).setHours(15, 15, 0, 0) / 1000, label: "15:15" },
          { timestamp: session.end, label: "18:10" },
        ].map((item) => ({ x: xForTimestamp(item.timestamp), label: item.label }))
      : (() => {
          const tickCount = Math.min(4, valid.length);
          const step = Math.max(1, Math.floor((valid.length - 1) / Math.max(1, tickCount - 1)));
          return Array.from({ length: tickCount }, (_, i) => {
            const idx = Math.min(i * step, valid.length - 1);
            return { x: x(idx), label: formatDate(ts[idx], range) };
          });
        })();

    const yLabels = Array.from({ length: 4 }, (_, i) => {
      const p = minP + (pRange * i) / 3;
      return { y: y(p), label: formatPrice(p) };
    });

    return {
      pathFill,
      lineSegments,
      overlayPaths,
      candles,
      baselineY: y(firstPrice),
      baselineLabel: `Başlangıç ${formatPrice(firstPrice)}`,
      baselineColor: overallColor,
      volBars,
      xLabels,
      yLabels,
    };
  }, [closes, opens, highs, lows, volumes, timestamps, range, chartType, chartHeight, chartW, priceH, volH, overlays, colors]);

  if (closes.filter((c) => c > 0).length < 2) {
    return (
      <View style={[styles.empty, { height: chartHeight + MB }]}>

        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Grafik verisi yükleniyor...</Text>
      </View>
    );
  }

  const totalH = chartHeight + MB;
  return (
    <View>
      <Svg width={width} height={totalH}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={baselineColor} stopOpacity="0.25" />
            <Stop offset="1" stopColor={baselineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {yLabels.map((lbl, i) => (
          <React.Fragment key={`grid-${i}`}>
            <Line x1={ML} y1={lbl.y} x2={ML + chartW} y2={lbl.y} stroke={colors.border} strokeWidth={0.5} strokeDasharray="3,4" />
            <SvgText x={ML - 4} y={lbl.y + 4} fontSize={9} fill={colors.mutedForeground} textAnchor="end">{lbl.label}</SvgText>
          </React.Fragment>
        ))}
        {chartType === "line" ? (
          <>
            <Path d={pathFill} fill="url(#grad)" />
            {lineSegments.map((segment, i) => (
              <Path key={`line-${i}`} d={segment.d} stroke={segment.color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </>
        ) : (
          candles.map((candle, i) => (
            <React.Fragment key={`candle-${i}`}>
              <Line x1={candle.x} y1={candle.highY} x2={candle.x} y2={candle.lowY} stroke={candle.color} strokeWidth={1.2} />
              <Rect
                x={candle.x - candle.width / 2}
                y={Math.min(candle.openY, candle.closeY)}
                width={candle.width}
                height={Math.max(1.5, Math.abs(candle.closeY - candle.openY))}
                fill={candle.color}
                stroke={candle.color}
                rx={0.7}
              />
            </React.Fragment>
          ))
        )}
        {overlayPaths.map((overlay) => (
          <Path key={`overlay-${overlay.label}`} d={overlay.d} stroke={overlay.color} strokeWidth={1.4} fill="none" opacity={0.9} />
        ))}
        <Line x1={ML} y1={baselineY} x2={ML + chartW} y2={baselineY} stroke={baselineColor} strokeWidth={1} strokeDasharray="5,4" opacity={0.75} />
        <SvgText x={ML + 4} y={baselineY - 4} fontSize={8} fill={baselineColor}>{baselineLabel}</SvgText>
        {volBars.map((bar, i) => (
          <Rect key={`vol-${i}`} x={bar.x} y={MT + priceH + 6 + (volH - bar.h)} width={bar.w} height={bar.h} fill={bar.color} opacity={0.35} />
        ))}
        {xLabels.map((lbl, i) => (
          <SvgText key={`x-${i}`} x={lbl.x} y={totalH - 4} fontSize={9} fill={colors.mutedForeground} textAnchor="middle">{lbl.label}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center" },
});
