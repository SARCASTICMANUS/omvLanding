import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import PrimaryButton from "../../shared/components/common/VayyButton";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function DriverTripHistoryScreen({ navigation, mode = "auto" }) {
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.primary;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <AppFrame navigation={navigation} title="Trip complete" accent={accent}>
      <View style={styles.pageCentered}>
        <Animated.View style={[styles.check, { backgroundColor: accent, transform: [{ scale }] }]}>
          <Text style={styles.checkText}>✓</Text>
        </Animated.View>
        <Text style={styles.heroSmall}>Total earned: ₹210</Text>
        <Text style={styles.muted}>{isBike ? "CO2 saved badge unlocked" : "Passengers served: 8 · Fuel Saved"}</Text>
        {isBike && <Text style={styles.stars}>★ ★ ★ ★ ★</Text>}
        <PrimaryButton label="Start New Trip" onPress={() => navigation.popToTop()} style={{ backgroundColor: accent }} />
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  pageCentered: {
    flex: 1,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  check: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: colors.white,
    fontSize: 54,
    fontWeight: "900",
  },
  heroSmall: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  stars: {
    color: colors.bikeLight,
    fontSize: 24,
    letterSpacing: 2,
  },
});
