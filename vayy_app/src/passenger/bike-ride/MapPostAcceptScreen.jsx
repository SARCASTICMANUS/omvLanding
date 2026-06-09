import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import MapPlaceholder from "../../components/MapPlaceholder";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import PrimaryButton from "../../shared/components/common/PrimaryButton";

export function BikeMapPostAcceptScreen({ navigation }) {
  const labels = ["Priya is 1.2 km away", "Priya is 800m away", "Priya is 400m away"];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((value) => Math.min(value + 1, labels.length - 1)), 2000);
    return () => clearInterval(timer);
  }, [labels.length]);
  return (
    <AppFrame navigation={navigation} title="Driver arriving" accent={colors.bikeAccent}>
      <View style={styles.mapPage}>
        <MapPlaceholder accent={colors.bikeAccent} vehicle="🏍️" />
        <View style={styles.arrivalCard}>
          <Text style={styles.heroSmall}>{labels[step]}</Text>
          <Text style={styles.muted}>Arriving in {5 - step * 2} min</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.dangerLink}>Cancel ride</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mapBottom}>
          <PrimaryButton label="Show Rider Popup" accent={colors.bikeAccent} onPress={() => navigation.navigate("RiderPopup")} />
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
  arrivalCard: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
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
  dangerLink: {
    color: colors.danger,
    fontWeight: "900",
  },
  mapBottom: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.md,
  },
});
