import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import DisclaimerModal from "@/components/DisclaimerModal";
import { StockProvider } from "@/contexts/StockContext";
import { PortfolioProvider } from "@/contexts/PortfolioContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { WatchlistProvider } from "@/contexts/WatchlistContext";
import { AlertProvider } from "@/contexts/AlertContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Geri" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="stock/[symbol]"
        options={{
          headerBackTitle: "Geri",
          presentation: "card",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status !== "granted") {
        Notifications.requestPermissionsAsync();
      }
    });
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <FavoritesProvider>
                <WatchlistProvider>
                  <StockProvider>
                    <PortfolioProvider>
                      <AlertProvider>
                        <RootLayoutNav />
                        <DisclaimerModal />
                      </AlertProvider>
                    </PortfolioProvider>
                  </StockProvider>
                </WatchlistProvider>
              </FavoritesProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
