import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";

const DISCLAIMER_KEY = "bist_disclaimer_accepted_v1";

export default function DisclaimerModal() {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const accepted = await AsyncStorage.getItem(DISCLAIMER_KEY);
        if (!accepted) setVisible(true);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const handleAccept = useCallback(async () => {
    if (!checked) return;
    await AsyncStorage.setItem(DISCLAIMER_KEY, "1");
    setVisible(false);
  }, [checked]);

  if (!ready || !visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Uyarı</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            BIST Gözcü, SPK düzenlemeleri kapsamında 15 dakika gecikmeli borsa verilerini ve teknik
            göstergeleri bilgilendirme amacıyla sunan bir deneyim uygulamasıdır. Uygulamadaki
            fiyatlar, sinyaller ve analizler{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
              yatırım tavsiyesi değildir
            </Text>
            . Yatırım kararlarınızı almadan önce lisanslı bir yatırım danışmanına başvurun.
            Uygulamayı kullanarak bu koşulları kabul etmiş sayılırsınız.
          </Text>

          <Pressable
            style={styles.checkRow}
            onPress={() => setChecked((c) => !c)}
            hitSlop={8}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: checked ? colors.primary : colors.border,
                  backgroundColor: checked ? colors.primary : "transparent",
                },
              ]}
            >
              {checked && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, { color: colors.foreground }]}>
              Okudum, anladım ve kabul ediyorum.
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              { backgroundColor: checked ? colors.primary : colors.border },
            ]}
            disabled={!checked}
            onPress={handleAccept}
          >
            <Text
              style={[
                styles.buttonText,
                { color: checked ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              Devam Et
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  checkLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  button: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  buttonText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
