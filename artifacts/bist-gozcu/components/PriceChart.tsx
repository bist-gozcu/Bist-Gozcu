import React, { useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions, Pressable } from "react-native";
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

export default function PriceChart({ closes, volumes, timestamps, range }: PriceChartProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();

  const chartW = width - ML - MR;
  const priceH = CHART_H - VOL_H - 6;

  const { pathLine, pathFill, color, minP, maxP, volBars, xLabels, yLabels } = useMemo(() => {
    const valid = closes.map((c, i) => ({ c, v: volumes[i] ?? 0, t: timestamps[i] ?? 0 }))
      .filter((d) => d.c > 0);

    if (valid.length < 2) {
      return { pathLine: "", pathFill: "", color: colors.up, minP: 0, maxP: 0, volBars: [], xLabels: [], yLabels: [] };
    }

    const cs = valid.map((d) => d.c);
    const vs = valid.map((d) => d.v);
    const ts = valid.map((d) => d.t);

    const minP = Math.min(...cs);
    const maxP = Math.max(...cs);
    const pRange = maxP - minP || 1;

    const x = (i: number) => ML + (i / (valid.length - 1)) * chartW;
    const y = (p: number) => MT + priceH * (1 - (p - minP) / pRange);

    const pts = valid.map((d, i) => ({ x: x(i), y: y(d.c) }));
    const pathLine = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const pathFill = `${pathLine} L${pts[pts.length - 1].x.toFixed(1)},${(MT + priceH).toFixed(1)} L${ML.toFixed(1)},${(MT + priceH).toFixed(1)} Z`;

    const color = cs[cs.length - 1] >= cs[0] ? colors.up : colors.down;

    const maxVol = Math.max(...vs, 1);
    const barW = Math.max(1, (chartW / valid.length) - 1);
    const volBars = vs.map((v, i) => ({
      x: x(i) - barW / 2,
      h: (v / maxVol) * VOL_H,
      w: barW,
    }));

    const tickCount = Math.min(4, valid.length);
    const step = Math.floor((valid.length - 1) / (tickCount - 1));
    const xLabels = Array.from({ length: tickCount }, (_, i) => {
      const idx = Math.min(i * step, valid.length - 1);
      return { x: x(idx), label: formatDate(ts[idx], range) };
    });

    const yLabelCount = 4;
    const yLabels = Array.from({ length: yLabelCount }, (_, i) => {
      const p = minP + (pRange * i) / (yLabelCount - 1);
      return { y: y(p), label: formatPrice(p) };
    });

    return { pathLine, pathFill, color, minP, maxP, volBars, xLabels, yLabels };
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
            <Stop offset="0" stopColor={color} stopOpacity="0.25" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {yLabels.map((lbl, i) => (
          <React.Fragment key={i}>
            <Line
              x1={ML}
              y1={lbl.y}
              x2={ML + chartW}
              y2={lbl.y}
              stroke={colors.border}
              strokeWidth={0.5}
              strokeDasharray="3,4"
            />
            <SvgText
              x={ML - 4}
              y={lbl.y + 4}
              fontSize={9}
              fill={colors.mutedForeground}
              textAnchor="end"
            >
              {lbl.label}
            </SvgText>
          </React.Fragment>
        ))}

        <Path d={pathFill} fill="url(#grad)" />
        <Path d={pathLine} stroke={color} strokeWidth={1.5} fill="none" />

        {volBars.map((bar, i) => (
          <Rect
            key={i}
            x={bar.x}
            y={MT + priceH + 6 + (VOL_H - bar.h)}
            width={bar.w}
            height={bar.h}
            fill={color}
            opacity={0.35}
          />
        ))}

        {xLabels.map((lbl, i) => (
          <SvgText
            key={i}
            x={lbl.x}
            y={totalH - 4}
            fontSize={9}
            fill={colors.mutedForeground}
            textAnchor="middle"
          >
            {lbl.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center" },
});
