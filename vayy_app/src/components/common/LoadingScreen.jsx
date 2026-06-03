import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import COLORS from "../../constants/colors";
import SPACING from "../../constants/spacing";

export default function LoadingScreen({ label = "Loading VAYY" }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.label}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    alignItems: "center",
    flex: 1,
    gap: SPACING.base,
    justifyContent: "center",
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});
