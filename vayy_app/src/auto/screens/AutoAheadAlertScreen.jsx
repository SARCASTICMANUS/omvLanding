import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import PrimaryButton from "../../shared/components/common/PrimaryButton";
import { passengers } from "../../data/passengers";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function AutoAheadAlertScreen({ navigation }) {
  const [count, setCount] = useState(10);
  useEffect(() => {
    const timer = setInterval(() => setCount((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <AppFrame navigation={navigation} title="Ahead alert" accent={colors.autoAccent}>
      <View style={styles.page}>
        <View style={styles.alertCard}>
          <Text style={styles.heroSmall}>{passengers[0].name}</Text>
          <Text style={styles.muted}>500m ahead on your route</Text>
          <Text style={styles.countdown}>{count}</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton label="Accept ✓" accent={colors.primary} onPress={() => navigation.navigate("BoardedPopup")} />
          <PrimaryButton label="Ignore ✕" accent={colors.textMuted} outline onPress={() => navigation.goBack()} />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  heroSmall: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  countdown: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: colors.autoAccent,
    color: colors.textPrimary,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 24,
    fontWeight: "900",
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
  },
});
