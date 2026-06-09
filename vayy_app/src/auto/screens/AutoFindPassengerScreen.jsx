import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import MapPlaceholder from "../../components/MapPlaceholder";
import StatBar from "../../components/StatBar";
import { currentTrip } from "../../data/trips";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import PrimaryButton from "../../shared/components/common/PrimaryButton";

export function FindPassengerScreen({ navigation }) {
  const accent = colors.autoAccent;
  const vehicle = "🛺";
  const title = "Find passenger";
  const copy = "Ravi K. is waiting 500m ahead";
  const next = "AheadAlert";

  return (
    <AppFrame navigation={navigation} title={title} accent={accent}>
      <View style={styles.split}>
        <MapPlaceholder accent={accent} vehicle={vehicle} compact />
        <View style={styles.infoPanel}>
          <Text style={styles.heroSmall}>{copy}</Text>
          <StatBar accent={accent} stats={[
            { label: "Fare", value: "₹15" },
            { label: "Passenger", value: "500m" },
            { label: "Destination", value: "3.2 km" },
            { label: "Next stop", value: "Civil Lines" },
            { label: "Speed", value: currentTrip.speed },
            { label: "ETA", value: "4 min" },
          ]} />
          <PrimaryButton label="Continue" accent={accent} onPress={() => navigation.navigate(next)} />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  split: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  infoPanel: {
    flex: 1,
    gap: spacing.md,
  },
  heroSmall: {
    ...typography.h2,
    color: colors.textPrimary,
  },
});
