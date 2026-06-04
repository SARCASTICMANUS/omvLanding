import "react-native-gesture-handler";

import React from "react";
import { Provider } from "react-redux";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AppNavigator from "./src/navigation/AppNavigator";
import { LanguageProvider } from "./src/shared/lib/i18n/LanguageContext";
import { store } from "./src/store/store";

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <LanguageProvider>
          <StatusBar style="dark" backgroundColor="#FFFFFF" />
          <AppNavigator />
        </LanguageProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
