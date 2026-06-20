import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import StatBar from "../../components/StatBar";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import PrimaryButton from "../../shared/components/common/PrimaryButton";

export function BestMatchRouteScreen({ navigation, mode = "auto" }) {
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.autoAccent;
  return (
    <AppFrame navigation={navigation} title="Best match route" accent={accent}>
      <View style={styles.page}>
        <View style={styles.matchCard}>
          <Text style={styles.roleIcon}>{isBike ? "🏍️" : "🛺"}</Text>
          <Text style={styles.heroSmall}>Hazratganj → Charbagh</Text>
          <Text style={styles.muted}>MG Road · Civil Lines · Lalbagh · Charbagh</Text>
          <StatBar accent={accent} stats={[
            { label: "Earning", value: isBike ? "₹90-₹130" : "₹180-₹240" },
            { label: "Distance", value: isBike ? "6 km" : "12 km" },
            { label: "Stops", value: isBike ? "3" : "7" },
          ]} />
        </View>
        <PrimaryButton label="Accept Route" accent={accent} onPress={() => navigation.navigate(isBike ? "FindRideBuddy" : "FindPassenger")} />
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
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  roleIcon: {
    fontSize: 30,
  },
  heroSmall: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
