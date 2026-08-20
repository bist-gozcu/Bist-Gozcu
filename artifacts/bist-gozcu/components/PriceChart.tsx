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

interface PriceChartProps {
  closes: number[];
  opens?: number[];
  highs?: number[];
  lows?: number[];
  volumes: number[];
  timestamps: number[];
  range: ChartRange;
  chartType?: ChartType;
  onToggleType?: () => void;
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

type Point = { c: number; v: number; t: number; x: number; y: number };
type LineSegment = { d: string; color: string };

function formatDate(ts: number, range: ChartRange): string {
  const d = new Date(ts * 1000);
  if (range === "1d") {
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "5d") {
    return d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" });
  }
  if (range === "5y" || range === "1y") {
    return d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
  }
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

export default function PriceChart({ closes, volumes, timestamps, range }: PriceChartProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();

  const chartW = Math.max(180, width - ML - MR);
  const priceH = CHART_H - VOL_H - 6;

  const {
    pathFill,
    lineSegments,
    baselineY,
    baselineLabel,
    baselineColor,
    volBars,
    xLabels,
    yLabels,
    minP,
    maxP,
  } = useMemo(() => {
    const valid = closes
      .map((c, i) => ({ c, v: volumes[i] ?? 0, t: timestamps[i] ?? 0 }))
      .filter((d) => d.c > 0 && d.t > 0);

    if (valid.length < 2) {
      return {
        pathFill: "",
        lineSegments: [] as LineSegment[],
        baselineY: 0,
        baselineLabel: "Başlangıç",
        baselineColor: colors.mutedForeground,
        volBars: [] as { x: number; h: number; w: number; color: string }[],
        xLabels: [] as { x: number; label: string }[],
        yLabels: [] as { y: number; label: string }[],
        minP: 0,
        maxP: 0,
      };
    }

    const cs = valid.map((d) => d.c);
    const vs = valid.map((d) => d.v);
    const ts = valid.map((d) => d.t);
    const minP = Math.min(...cs);
    const maxP = Math.max(...cs);
    const pRange = maxP - minP || 1;
    const firstPrice = cs[0];
    const lastPrice = cs[cs.length - 1];
    const overallColor = lastPrice >= firstPrice ? colors.up : colors.down;
    const session = range === "1d" ? localSessionBounds(ts[ts.length - 1]) : null;

    const x = (i: number): number => {
      if (!session || range !== "1d") {
        return ML + (i / (valid.length - 1)) * chartW;
      }
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

    const maxVol = Math.max(...vs, 1);
    const barW = Math.max(1, chartW / Math.max(valid.length, 1) - 1);
    const volBars = vs.map((v, i) => ({
      x: x(i) - barW / 2,
      h: (v / maxVol) * VOL_H,
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

    const yLabelCount = 4;
    const yLabels = Array.from({ length: yLabelCount }, (_, i) => {
      const p = minP + (pRange * i) / (yLabelCount - 1);
      return { y: y(p), label: formatPrice(p) };
    });

    return {
      pathFill,
      lineSegments,
      baselineY: y(firstPrice),
      baselineLabel: `Başlangıç ${formatPrice(firstPrice)}`,
      baselineColor: overallColor,
      volBars,
      xLabels,
      yLabels,
      minP,
      maxP,
    };
  }, [closes, volumes, timestamps, range, chartW, priceH, colors]);

  if (closes.filter((c) => c > 0).length < 2) {
    return (
      <View style={[styles.empty, { height: CHART_H + MB }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Grafik verisi yükleniyor...</Text>
      </View>
    );
  }

  const totalH = CHART_H + MB;

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

        <Path d={pathFill} fill="url(#grad)" />
        <Line x1={ML} y1={baselineY} x2={ML + chartW} y2={baselineY} stroke={baselineColor} strokeWidth={1} strokeDasharray="5,4" opacity={0.75} />
        <SvgText x={ML + 4} y={baselineY - 4} fontSize={8} fill={baselineColor}>{baselineLabel}</SvgText>

        {lineSegments.map((segment, i) => (
          <Path key={`line-${i}`} d={segment.d} stroke={segment.color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {volBars.map((bar, i) => (
          <Rect key={`vol-${i}`} x={bar.x} y={MT + priceH + 6 + (VOL_H - bar.h)} width={bar.w} height={bar.h} fill={bar.color} opacity={0.35} />
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
