import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import StockRow from "@/components/StockRow";
import EmptyState from "@/components/EmptyState";

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
  const { quotes, refresh } = useStocks();
  const { favorites, removeFavorite, reorder } = useFavorites();
  const [editMode, setEditMode] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await refresh();
    } finally {
      setManualRefreshing(false);
    }
  }, [refresh]);

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  return (
    <GestureHandlerRootView style={styles.root}>
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
        <DraggableFlatList
          data={favorites}
          keyExtractor={(item) => item}
          activationDistance={editMode ? 0 : 12}
          onDragEnd={({ from, to }) => {
            if (editMode && from !== to) reorder(from, to);
          }}
          renderItem={({ item, drag, isActive }: RenderItemParams<string>) => (
            <Pressable
              onLongPress={() => {
                if (editMode) drag();
              }}
              disabled={!editMode}
              style={[styles.rowWrap, isActive && { backgroundColor: colors.accent }]}
            >
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
            </Pressable>
          )}
          refreshControl={
            <RefreshControl
              refreshing={manualRefreshing}
              onRefresh={handleManualRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
