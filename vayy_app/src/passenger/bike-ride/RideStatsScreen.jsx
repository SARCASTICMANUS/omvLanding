import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import MapPlaceholder from "../../components/MapPlaceholder";
import StatBar from "../../components/StatBar";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export function RideStatsScreen({ navigation }) {
  const [fare, setFare] = useState(30);
  useEffect(() => {
    const timer = setInterval(() => setFare((value) => value + 2), 1800);
    return () => clearInterval(timer);
  }, []);
  return (
    <AppFrame navigation={navigation} title="Ride active" accent={colors.bikeAccent}>
      <View style={styles.mapPage}>
        <MapPlaceholder accent={colors.bikeAccent} vehicle="🏍️" routeLine />
        <View style={styles.mapBottom}>
          <StatBar accent={colors.bikeAccent} stats={[
            { label: "Fare meter", value: `₹${fare}` },
            { label: "Remaining", value: "2.1 km" },
            { label: "Stop", value: "Charbagh" },
            { label: "ETA", value: "6 min" },
            { label: "Driver", value: "Priya" },
            { label: "Rating", value: "4.9" },
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
  mapBottom: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.md,
  },
});
