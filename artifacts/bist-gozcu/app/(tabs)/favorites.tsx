import React, { useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Animated,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useStocks } from "@/contexts/StockContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import StockRow from "@/components/StockRow";
import EmptyState from "@/components/EmptyState";

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { quotes, loading, refresh } = useStocks();
  const { favorites, removeFavorite, reorder } = useFavorites();
  const [editMode, setEditMode] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;

  const topPaddingStyle = Platform.OS === "web" ? { paddingTop: insets.top + 10 } : {};

  const handleLongPress = (index: number) => {
    if (!editMode) setEditMode(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, topPaddingStyle]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Favoriler
        </Text>
        {favorites.length > 0 && (
          <Pressable onPress={() => setEditMode((v) => !v)} hitSlop={8}>
            <Text style={[styles.editBtn, { color: editMode ? colors.primary : colors.mutedForeground }]}>
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
                  <Feather name="minus-circle" size={20} color={colors.down} />
                </Pressable>
              )}
              <View style={styles.rowFlex}>
                <StockRow
                  symbol={item}
                  quote={quotes[item]}
                  showFavoriteBtn={false}
                />
              </View>
              {editMode && (
                <View style={styles.dragHandle}>
                  <Feather name="menu" size={18} color={colors.mutedForeground} />
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  editBtn: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowWrap: { flexDirection: "row", alignItems: "center" },
  rowFlex: { flex: 1 },
  deleteBtn: { paddingLeft: 12 },
  dragHandle: { paddingRight: 12 },
});
