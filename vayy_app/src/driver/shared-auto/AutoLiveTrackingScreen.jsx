import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import MapView from "react-native-maps";
import StatBar from "../../components/StatBar";
import PrimaryButton from "../../shared/components/common/VayyButton";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { currentTrip } from "../../data/trips";

export default function AutoLiveTrackingScreen({ navigation, mode = "auto" }) {
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.autoAccent;
  const [earning, setEarning] = useState(isBike ? 42 : 87);

  useEffect(() => {
    const timer = setInterval(() => setEarning((value) => value + (isBike ? 3 : 5)), 2200);
    return () => clearInterval(timer);
  }, [isBike]);

  return (
    <AppFrame navigation={navigation} title="Trip active" accent={accent}>
      <View style={styles.mapPage}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: 26.8467,
            longitude: 80.9462,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${currentTrip.routeProgress * 100}%`, backgroundColor: accent }]} />
        </View>
        <View style={styles.mapBottom}>
          <StatBar accent={accent} stats={[
            { label: isBike ? "Buddy" : "On board", value: isBike ? "1" : `${currentTrip.passengersOnboard}` },
            { label: "Earned", value: `₹${earning}` },
            { label: "Next stop", value: currentTrip.nextStop },
          ]} />
          <PrimaryButton 
            label="End Trip" 
            onPress={() => navigation.navigate(isBike ? "BikeTripComplete" : "AutoTripComplete")} 
            style={{ backgroundColor: colors.danger }}
          />
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
  progressTrack: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  mapBottom: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.md,
  },
});
