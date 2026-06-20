import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import PrimaryButton from "../../shared/components/common/PrimaryButton";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function AutoBoardedPopupScreen({ navigation }) {
  return (
    <AppFrame navigation={navigation} title="Boarding check" accent={colors.autoAccent}>
      <View style={styles.sheetOnly}>
        <Text style={styles.heroSmall}>Did Ravi Kumar board?</Text>
        <Text style={styles.muted}>Destination: Charbagh · Next stop: Civil Lines</Text>
        <View style={styles.actions}>
          <PrimaryButton label="Yes, Boarded ✓" accent={colors.primary} onPress={() => navigation.navigate("AutoRideActive")} />
          <PrimaryButton label="No, Skip" accent={colors.textMuted} outline onPress={() => navigation.goBack()} />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  sheetOnly: {
    margin: spacing.md,
    marginTop: "auto",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
  },
  heroSmall: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
  },
});
