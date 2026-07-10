import React, { useCallback, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import StockRow from "@/components/StockRow";
import EmptyState from "@/components/EmptyState";
import { IconArrowUp, IconArrowDown } from "@/components/TabIcon";

function IconMinusCircle({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes, loading, refresh } = useStocks();
  const { favorites, removeFavorite, reorder } = useFavorites();
  const [editMode, setEditMode] = useState(false);

  const handleMove = useCallback((symbol: string, direction: -1 | 1) => {
    const from = favorites.indexOf(symbol);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= favorites.length) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    reorder(from, to);
  }, [favorites, reorder]);

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Favoriler</Text>
          {favorites.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.countText, { color: colors.mutedForeground }]}>{favorites.length}</Text>
            </View>
          )}
        </View>
        {favorites.length > 0 && (
          <Pressable
            onPress={() => setEditMode((v) => !v)}
            hitSlop={10}
            style={[styles.editBtn, { backgroundColor: editMode ? `${colors.primary}20` : colors.secondary }]}
          >
            <Text style={[styles.editBtnText, { color: editMode ? colors.primary : colors.mutedForeground }]}>
              {editMode ? "Tamam" : "Düzenle"}
            </Text>
          </Pressable>
        )}
      </View>

      {favorites.length === 0 ? (
        <EmptyState
          icon="star"
          title="Favori hisse yok"
          subtitle="Piyasa veya Arama ekranından yıldıza basarak hisse ekleyin"
        />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item}
          renderItem={({ item, index }) => (
            <View style={styles.rowWrap}>
              {editMode && (
                <Pressable
                  onPress={() => removeFavorite(item)}
                  hitSlop={8}
                  style={styles.deleteBtn}
                >
                  <IconMinusCircle color={colors.down} size={22} />
                </Pressable>
              )}
              <View style={styles.rowFlex}>
                <StockRow
                  symbol={item}
                  quote={quotes[item]}
                  showFavoriteBtn={!editMode}
                />
              </View>
              {editMode && (
                <View style={styles.reorderBtns}>
                  <Pressable
                    onPress={() => handleMove(item, -1)}
                    disabled={index === 0}
                    hitSlop={6}
                    style={styles.reorderBtn}
                  >
                    <IconArrowUp color={index === 0 ? colors.border : colors.mutedForeground} size={16} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleMove(item, 1)}
                    disabled={index === favorites.length - 1}
                    hitSlop={6}
                    style={styles.reorderBtn}
                  >
                    <IconArrowDown color={index === favorites.length - 1 ? colors.border : colors.mutedForeground} size={16} />
                  </Pressable>
                </View>
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  countBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  editBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rowWrap: { flexDirection: "row", alignItems: "center" },
  rowFlex: { flex: 1 },
  deleteBtn: { paddingLeft: 14, paddingRight: 4 },
  reorderBtns: { flexDirection: "column", paddingHorizontal: 10, gap: 6 },
  reorderBtn: { padding: 2 },
});
