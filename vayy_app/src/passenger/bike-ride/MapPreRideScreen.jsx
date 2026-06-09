import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import MapPlaceholder from "../../components/MapPlaceholder";
import RaiseHandButton from "../../components/RaiseHandButton";
import StatBar from "../../components/StatBar";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import PrimaryButton from "../../shared/components/common/PrimaryButton";

export function BikeMapPreRideScreen({ navigation }) {
  return (
    <AppFrame navigation={navigation} title="Bike pickup" accent={colors.bikeAccent}>
      <View style={styles.mapPage}>
        <MapPlaceholder accent={colors.bikeAccent} vehicle="🏍️" />
        <View style={styles.banner}><Text style={styles.bannerText}>Nearest stop: 200m away</Text></View>
        <View style={styles.mapBottom}>
          <RaiseHandButton accent={colors.bikeAccent} onPress={() => navigation.navigate("BikeMapPostAccept")} />
          <StatBar accent={colors.bikeAccent} stats={[
            { label: "Fare", value: "₹30" },
            { label: "Bikes nearby", value: "2" },
            { label: "Distance", value: "1.2 km" },
            { label: "ETA", value: "5 min" },
            { label: "Stop", value: "200m" },
            { label: "Route", value: "BR1" },
          ]} />
          <PrimaryButton label="Continue" accent={colors.bikeAccent} onPress={() => navigation.navigate("BikeMapPostAccept")} />
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
  mapBottom: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.md,
  },
  banner: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
  },
  bannerText: {
    color: colors.textPrimary,
    textAlign: "center",
    fontWeight: "900",
  },
});
