import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BusIconBadge from "../../components/common/BusIconBadge";
import MetricChip from "../../components/common/MetricChip";
import VayyButton from "../../components/common/VayyButton";
import StopsTimeline from "../../components/passenger/StopsTimeline";
import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

export function getStopStatus(stop, index, stops) {
  if (stop.status === "completed" || stop.is_completed) return { label: "Completed", type: "completed" };
  if (stop.status === "boarding" || stop.is_boarding) return { label: "Boarding Stop", type: "boarding" };
  if (index === stops.length - 1 || stop.status === "dropoff" || stop.is_dropoff) {
    return { label: "Drop-off Stop", type: "dropoff" };
  }
  return { label: "Upcoming", type: "upcoming" };
}

export function getDotColor(stop, index, stops) {
  const { type } = getStopStatus(stop, index, stops);
  if (type === "completed" || type === "boarding") return COLORS.primary;
  if (type === "dropoff") return COLORS.error;
  return COLORS.textLight;
}

const shortPlace = (point, fallback) =>
  point?.name || point?.display_name?.split(",")?.[0] || point?.address || fallback;

export default function PassengerStopsTimeline({ navigation, route }) {
  const selectedTrip = route?.params?.selectedTrip || route?.params?.trip;
  const pickup = route?.params?.pickup;
  const destination = route?.params?.destination;
  const stops = selectedTrip?.stops || [];
  const busNo = selectedTrip?.bus_number || selectedTrip?.vehicle_number || "UP 32 DC 0003";
  const tripId = selectedTrip?.trip_id || selectedTrip?.id;

  const onBack = () => navigation.goBack();
  const onTrackNow = () => navigation.navigate("PassengerLiveTracking", { tripId });
  const onEditRoute = () => navigation.goBack();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Confirm Your Trip</Text>
        <Text style={styles.subtitle}>Review your journey details</Text>

        <View style={styles.tripCard}>
          <Text style={styles.cardLabel}>YOUR TRIP</Text>
          <View style={styles.busRow}>
            <BusIconBadge size={52} />
            <View style={styles.busInfo}>
              <Text style={styles.busNo}>{busNo}</Text>
              <Text style={styles.eta}>Arrives in {selectedTrip?.eta_minutes || 5} min</Text>
            </View>
          </View>

          <View style={styles.routeRow}>
            <Text style={styles.routePlace}>{shortPlace(pickup, selectedTrip?.pickup_name || "Noida, UP")}</Text>
            <Text style={styles.routeArrow}>{"->"}</Text>
            <Text style={[styles.routePlace, styles.routePlaceRight]}>
              {shortPlace(destination, selectedTrip?.destination_name || "Delhi, Delhi")}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metricRow}>
            <MetricChip value={selectedTrip?.distance_text || "45km"} label="Distance" green />
            <MetricChip value={selectedTrip?.duration_text || "45 min"} label="Duration" green />
            <MetricChip value={stops.length || 8} label="Stops" green />
          </View>
        </View>

        <View style={styles.stopsCard}>
          <View style={styles.stopsHeader}>
            <Text style={styles.cardLabel}>JOURNEY STOPS</Text>
            <Text style={styles.arrowControls}>{"<  >"}</Text>
          </View>
          <StopsTimeline activeIndex={0} stops={stops} />
        </View>

        <View style={styles.featureGrid}>
          {["Live Tracking", "On Time", "Notifications", "Secure Journey"].map((label) => (
            <View key={label} style={styles.featureTile}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{label}</Text>
            </View>
          ))}
        </View>

        <VayyButton fullWidth label="Confirm & Track Bus ->" onPress={onTrackNow} size="lg" />
        <VayyButton fullWidth label="Edit Route" onPress={onEditRoute} variant="ghost" />
        <Text style={styles.footer}>Your safety is our priority</Text>
      </ScrollView>

      <View style={styles.sticky}>
        <VayyButton fullWidth label="Confirm & Track Bus ->" onPress={onTrackNow} size="lg" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B1215",
  },
  content: {
    gap: SPACING.base,
    padding: SPACING.base,
    paddingBottom: 110,
  },
  title: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  tripCard: {
    backgroundColor: "#062E1C",
    borderColor: "rgba(0, 230, 118, 0.2)",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.base,
    padding: SPACING.base,
  },
  stopsCard: {
    backgroundColor: "#10191D",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.base,
  },
  stopsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  cardLabel: {
    color: COLORS.liveAccent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  arrowControls: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
  },
  busRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  busInfo: {
    flex: 1,
  },
  busNo: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
  },
  eta: {
    color: COLORS.liveAccent,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },
  routeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  routePlace: {
    color: COLORS.white,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  routePlaceRight: {
    textAlign: "right",
  },
  routeArrow: {
    color: COLORS.liveAccent,
    fontSize: 14,
    fontWeight: "900",
  },
  divider: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    height: 1,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  featureTile: {
    alignItems: "center",
    backgroundColor: "#10191D",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexBasis: "47%",
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.base,
  },
  featureDot: {
    backgroundColor: COLORS.liveAccent,
    borderRadius: RADIUS.full,
    height: 10,
    width: 10,
  },
  featureText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
  footer: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
  },
  sticky: {
    backgroundColor: "#0B1215",
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    padding: SPACING.base,
    position: "absolute",
    right: 0,
  },
});
