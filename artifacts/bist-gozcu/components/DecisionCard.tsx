import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { ErkenHareketEtiketi, PiyasaHavasi } from "@/services/treydMotoru";
interface DecisionCardProps {
  sembol: string;
  skor: number;
  guncelFiyat: number;
  gunlukDegisim?: number;
  onPress?: () => void;
  hedefFiyat?: number;
  stopFiyat?: number;
  etiket?: string;
  teyitSayisi?: number;
  toplamTeyit?: number;
  trendTeyitli?: boolean;
  gunlukTrend?: "up" | "sideways" | "down";
  direnc?: number;
  direncKirildi?: boolean;
  hacimTeyitli?: boolean;
  ema20?: number;
  obvDirection?: "up" | "down" | "flat";
  obvTeyitli?: boolean;
  rsiValue?: number;
  rsiUygun?: boolean;
  yuksekDip?: boolean;
  yuksekTepe?: boolean;
  yapiTeyitli?: boolean;
  teyitler?: string[];
  radarDurumu?: "gunluk_teyitli" | "gun_ici_izleme" | "erken_hareket";
  erkenHareketSkoru?: number;
  erkenHareketEtiketi?: ErkenHareketEtiketi;
  erkenHareketNedenleri?: string[];
  piyasaHavasi?: PiyasaHavasi;
}

function SignalChip({
  label,
  confirmed,
  colors,
}: {
  label: string;
  confirmed: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: confirmed ? `${colors.up}18` : `${colors.down}14` },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: confirmed ? colors.up : colors.down },
        ]}
      >
        {confirmed ? "✓" : "—"} {label}
      </Text>
    </View>
  );
}

export default function DecisionCard({
  sembol,
  skor,
  guncelFiyat,
  gunlukDegisim,
  onPress,
  hedefFiyat,
  stopFiyat,
  etiket = "TAKİP LİSTESİ",
  teyitSayisi = 0,
  toplamTeyit = 6,
  trendTeyitli = false,
  gunlukTrend = "sideways",
  direnc,
  direncKirildi = false,
  hacimTeyitli = false,
  ema20,
  obvDirection = "flat",
  obvTeyitli = false,
  rsiValue,
  rsiUygun = false,
  yuksekDip = false,
  yuksekTepe = false,
  yapiTeyitli = false,
  teyitler = [],
  radarDurumu = "gun_ici_izleme",
  erkenHareketSkoru = 0,
  erkenHareketEtiketi = "NORMAL",
  erkenHareketNedenleri = [],
  piyasaHavasi = "Piyasa desteği zayıf",
}: DecisionCardProps) {
  const colors = useColors();
  const hasProximityBar =
    hedefFiyat !== undefined &&
    stopFiyat !== undefined &&
    hedefFiyat > stopFiyat &&
    guncelFiyat !== 0;

  const progress = hasProximityBar
    ? Math.min(
        100,
        Math.max(
          0,
          ((guncelFiyat - (stopFiyat as number)) /
            ((hedefFiyat as number) - (stopFiyat as number))) *
            100,
        ),
      )
    : null;
  const isStrongBuy = etiket === "GÜÇLÜ ALIM";
  const tagColor = isStrongBuy ? colors.up : colors.primary;
  // Günlük trend etiketi yalnızca toplam teyit 5/6 seviyesine ulaştığında olumlu yazılır.
  const dailyConfirmationComplete = teyitSayisi >= 5;
  const trendLabel =
    gunlukTrend === "up"
      ? "Trend yukarı"
      : gunlukTrend === "down"
        ? "Trend aşağı"
        : "Trend yatay";
  const rsiLabel = Number.isFinite(rsiValue)
    ? `RSI ${rsiValue?.toFixed(0)}`
    : "RSI yok";
  const resistanceLabel = Number.isFinite(direnc)
    ? `Direnç ₺${direnc?.toFixed(2)}`
    : "Direnç yok";
  const ema20Label = Number.isFinite(ema20)
    ? `EMA 20 ₺${ema20?.toFixed(2)}`
    : "EMA 20 yok";
  const obvLabel =
    obvDirection === "up"
      ? "OBV yukarı"
      : obvDirection === "down"
        ? "OBV aşağı"
        : "OBV yatay";
  const radarLabel =
    radarDurumu === "gunluk_teyitli"
      ? "Günlük kapanış teyitli"
      : radarDurumu === "erken_hareket"
        ? "Erken hareket radarı"
        : "Gün içi izleme";
  const radarColor =
    radarDurumu === "gunluk_teyitli" ? colors.up : colors.primary;
  const showEarlyMovement =
    Number.isFinite(erkenHareketSkoru) && erkenHareketSkoru >= 30;
  const earlyMovementColor =
    erkenHareketSkoru >= 70
      ? colors.up
      : erkenHareketSkoru >= 50
        ? colors.primary
        : colors.neutral;

  const dailyChange = Number.isFinite(gunlukDegisim)
    ? (gunlukDegisim as number)
    : null;
  const dailyChangeColor =
    dailyChange == null
      ? colors.mutedForeground
      : dailyChange >= 0
        ? colors.up
        : colors.down;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && onPress && { opacity: 0.78 },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <Text style={[styles.symbol, { color: colors.foreground }]}>
            {sembol}
          </Text>
          <View style={styles.priceLine}>
            <Text style={[styles.price, { color: colors.mutedForeground }]}>
              ₺{guncelFiyat.toFixed(2)}
            </Text>
            {dailyChange != null && (
              <Text style={[styles.dailyChange, { color: dailyChangeColor }]}>
                {dailyChange >= 0 ? "+" : ""}
                {dailyChange.toFixed(2)}%
              </Text>
            )}
          </View>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.label, { color: tagColor }]}>{etiket}</Text>
          <Text style={[styles.score, { color: colors.foreground }]}>
            {skor.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[styles.statusBadge, { backgroundColor: `${radarColor}18` }]}
        >
          <Text style={[styles.statusText, { color: radarColor }]}>
            {radarLabel}
          </Text>
        </View>
      </View>

      {showEarlyMovement && (
        <View style={styles.earlyMovementRow}>
          <View
            style={[
              styles.earlyMovementBadge,
              { backgroundColor: `${earlyMovementColor}18` },
            ]}
          >
            <Text
              style={[styles.earlyMovementText, { color: earlyMovementColor }]}
            >
              {erkenHareketEtiketi}
            </Text>
          </View>
          <Text
            style={[styles.earlyMovementScore, { color: earlyMovementColor }]}
          >
            {erkenHareketSkoru}/100
          </Text>
        </View>
      )}
      {showEarlyMovement && erkenHareketNedenleri.length > 0 && (
        <View style={styles.earlyReasons}>
          <Text
            style={[styles.earlyContext, { color: colors.mutedForeground }]}
          >
            {piyasaHavasi}
          </Text>
          {erkenHareketNedenleri.slice(0, 2).map((reason) => (
            <Text
              key={`early-${reason}`}
              style={[styles.earlyReason, { color: colors.mutedForeground }]}
            >
              {reason}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.confirmationRow}>
        <View
          style={[
            styles.confirmationBadge,
            {
              backgroundColor: dailyConfirmationComplete
                ? `${colors.up}18`
                : `${colors.neutral}18`,
            },
          ]}
        >
          <Text
            style={[
              styles.confirmationText,
              { color: dailyConfirmationComplete ? colors.up : colors.neutral },
            ]}
          >
            {dailyConfirmationComplete
              ? "Günlük trend teyitli"
              : "Günlük trend teyitsiz"}
          </Text>
        </View>
        <Text
          style={[styles.confirmationCount, { color: colors.mutedForeground }]}
        >
          {teyitSayisi}/{toplamTeyit} teyit
        </Text>
      </View>

      <View style={styles.signalGrid}>
        <SignalChip
          label={trendLabel}
          confirmed={trendTeyitli}
          colors={colors}
        />
        <SignalChip
          label={direncKirildi ? "Direnç kırıldı" : resistanceLabel}
          confirmed={direncKirildi}
          colors={colors}
        />
        <SignalChip label="Hacim" confirmed={hacimTeyitli} colors={colors} />
        <SignalChip
          label={ema20Label}
          confirmed={Number.isFinite(ema20) && guncelFiyat > (ema20 as number)}
          colors={colors}
        />
        <SignalChip label={obvLabel} confirmed={obvTeyitli} colors={colors} />
        <SignalChip label={rsiLabel} confirmed={rsiUygun} colors={colors} />
        <SignalChip label="Yüksek dip" confirmed={yuksekDip} colors={colors} />
        <SignalChip
          label="Yüksek tepe"
          confirmed={yuksekTepe}
          colors={colors}
        />
        <SignalChip
          label="Yapı teyitli"
          confirmed={yapiTeyitli}
          colors={colors}
        />
      </View>

      {teyitler.length > 0 && (
        <View style={styles.reasons}>
          {teyitler.slice(0, 7).map((reason) => (
            <Text
              key={reason}
              style={[styles.reason, { color: colors.mutedForeground }]}
            >
              {reason}
            </Text>
          ))}
        </View>
      )}

      {progress !== null && (
        <View style={styles.proximity}>
          <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.barFill,
                { width: `${progress}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <View style={styles.levels}>
            <Text style={[styles.level, { color: colors.down }]}>
              SL ₺{stopFiyat?.toFixed(2)}
            </Text>
            <Text style={[styles.level, { color: colors.up }]}>
              TP ₺{hedefFiyat?.toFixed(2)}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  identity: { flexShrink: 1 },
  symbol: { fontSize: 16, fontFamily: "Inter_700Bold" },
  priceLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  price: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dailyChange: { fontSize: 12, fontFamily: "Inter_700Bold" },
  scoreBox: { alignItems: "flex-end", marginLeft: 8 },
  label: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  score: { fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 2 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexShrink: 1,
  },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  earlyMovementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  earlyMovementBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexShrink: 1,
  },
  earlyMovementText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  earlyMovementScore: { fontSize: 11, fontFamily: "Inter_700Bold" },
  earlyReasons: { gap: 2 },
  earlyContext: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  earlyReason: { fontSize: 9, lineHeight: 13, fontFamily: "Inter_400Regular" },
  confirmationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmationBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  confirmationText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  confirmationCount: { fontSize: 10, fontFamily: "Inter_400Regular" },
  signalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  chipText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  reasons: { gap: 3 },
  reason: { fontSize: 10, lineHeight: 14, fontFamily: "Inter_400Regular" },
  proximity: { gap: 6 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  levels: { flexDirection: "row", justifyContent: "space-between" },
  level: { fontSize: 10, fontFamily: "Inter_500Medium" },
});
