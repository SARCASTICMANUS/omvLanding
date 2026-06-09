import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppFrame from "../../../components/AppFrame";
import MapPlaceholder from "../../../components/MapPlaceholder";
import RaiseHandButton from "../../../components/RaiseHandButton";
import StatBar from "../../../components/StatBar";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";

export function SharedAutoMapScreen({ navigation }) {
  return (
    <AppFrame navigation={navigation} title="Hazratganj → Charbagh" accent={colors.primary}>
      <View style={styles.mapPage}>
        <MapPlaceholder accent={colors.primary} vehicle="🛺" />
        <View style={styles.mapPill}><Text style={styles.mapPillText}>Route R1 · Civil Lines next</Text></View>
        <View style={styles.mapBottom}>
          <RaiseHandButton accent={colors.primary} />
          <StatBar accent={colors.primary} stats={[
            { label: "Local fare", value: "₹15" },
            { label: "Autos nearby", value: "3" },
            { label: "Auto distance", value: "180m" },
            { label: "Next stop", value: "Civil Lines" },
            { label: "ETA", value: "4 min" },
            { label: "Stop distance", value: "0.3 km" },
          ]} />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  mapPage: {
    flex: 1,
    padding: spacing.md,
  },
  mapPill: {
    position: "absolute",
    top: spacing.xl,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mapPillText: {
    color: colors.textPrimary,
    fontWeight: "800",
  },
  mapBottom: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.md,
  },
});
