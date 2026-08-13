import React from "react";
import { StyleSheet, Text, View } from "react-native";
import VayyMap from "../../shared/components/VayyMap";
import AppFrame from "../../components/AppFrame";
import RaiseHandButton from "../../components/RaiseHandButton";
import StatBar from "../../components/StatBar";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export function SharedAutoMapScreen({ navigation, route }) {
  const title = route?.params?.title || "Shared Auto";
  const localFare = route?.params?.localFare || "";
  const autosNearby = route?.params?.autosNearby || "";
  const autoDistance = route?.params?.autoDistance || "";
  const nextStop = route?.params?.nextStop || "";
  const eta = route?.params?.eta || "";
  const stopDistance = route?.params?.stopDistance || "";
  const pillText = route?.params?.pillText || "";

  return (
    <AppFrame navigation={navigation} title={title} accent={colors.primary}>
      <View style={styles.mapPage}>
        <VayyMap
          style={styles.mapBg}
          initialRegion={{
            latitude: route?.params?.latitude || 26.8467,
            longitude: route?.params?.longitude || 80.9462,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        />
        {pillText ? <View style={styles.mapPill}><Text style={styles.mapPillText}>{pillText}</Text></View> : null}
        <View style={styles.mapBottom}>
          <RaiseHandButton accent={colors.primary} />
          <StatBar accent={colors.primary} stats={[
            { label: "Local fare", value: localFare ? `₹${localFare}` : "—" },
            { label: "Autos nearby", value: autosNearby || "—" },
            { label: "Auto distance", value: autoDistance || "—" },
            { label: "Next stop", value: nextStop || "—" },
            { label: "ETA", value: eta ? `${eta} min` : "—" },
            { label: "Stop distance", value: stopDistance || "—" },
          ]} />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  mapPage: {
    flex: 1,
    position: "relative",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
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
