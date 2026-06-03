import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BusIconBadge from "../../components/common/BusIconBadge";
import MetricChip from "../../components/common/MetricChip";
import RouteLine from "../../components/common/RouteLine";
import VayyButton from "../../components/common/VayyButton";
import VayyCard from "../../components/common/VayyCard";
import Header from "../../components/navigation/Header";
import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";
import api from "../../lib/api";
import { buildRouteSummary, estimateStopTimeline } from "./driverFlowUtils";

export default function DriverTripReview({ navigation, route: navRoute }) {
  const { route, source, destination } = navRoute?.params || {};
  const [starting, setStarting] = useState(false);
  const summary = buildRouteSummary(route || {});
  const rows = useMemo(() => estimateStopTimeline(route || {}), [route]);

  const onBack = () => navigation.goBack();

  const onStartTrip = async () => {
    if (!route) return;

    setStarting(true);
    try {
      const response = await api.post("/api/driver/start-trip/", {
        route_id: String(route.id || route.route_id),
      });
      navigation.navigate("DriverLiveTracking", { route, activeTrip: response.data });
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        onBack={onBack}
        right={<VayyButton label="Edit Route" onPress={onBack} size="sm" variant="outline" />}
        subtitle="Review your route, stops and trip details"
        title="Trip Review"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <VayyCard style={styles.overview}>
          <View style={styles.overviewHead}>
            <BusIconBadge size={42} />
            <Text style={styles.sectionTitle}>Route Overview</Text>
          </View>
          <RouteLine progress={50} />
          <View style={styles.fromTo}>
            <View style={styles.placeCol}>
              <Text style={styles.place}>{summary.startLabel}</Text>
              <Text style={styles.time}>{summary.startTimeLabel}</Text>
            </View>
            <Text style={styles.arrow}>{"->"}</Text>
            <View style={[styles.placeCol, styles.placeRight]}>
              <Text style={styles.place}>{summary.endLabel}</Text>
              <Text style={styles.time}>{summary.endTimeLabel}</Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <MetricChip value={summary.durationText} label="ETA" green />
            <MetricChip value={summary.distanceText} label="Distance" green />
            <MetricChip value={summary.vehicleNumber || summary.bus_number || "--"} label="Vehicle" green />
          </View>
        </VayyCard>

        <VayyCard style={styles.stopsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Route Stops</Text>
            <VayyButton label="View on Map" onPress={() => {}} size="sm" variant="outline" />
          </View>

          <View style={styles.columnHeader}>
            <Text style={styles.columnText}>Arrival</Text>
            <Text style={styles.columnText}>Stop Details</Text>
            <Text style={styles.columnText}>Departure</Text>
          </View>

          {rows.map((stop, index) => {
            const isFirst = index === 0;
            const isLast = index === rows.length - 1;

            return (
              <View key={stop.id} style={[styles.stopRow, isFirst && styles.activeStop]}>
                <Text style={styles.stopArrival}>{stop.arrivalLabel}</Text>
                <View style={styles.stopTimeline}>
                  <View
                    style={[
                      styles.stopDot,
                      isFirst && styles.greenDot,
                      isLast && styles.redDot,
                    ]}
                  />
                </View>
                <View style={styles.stopInfo}>
                  <Text style={[styles.stopName, isFirst && styles.activeStopName]}>{stop.name}</Text>
                  <Text style={styles.stopSub}>{stop.status}</Text>
                </View>
                <Text style={styles.stopDeparture}>{stop.departure_time || "--"}</Text>
              </View>
            );
          })}
        </VayyCard>

        <VayyCard style={styles.summaryCard}>
          <View style={styles.ready}>
            <BusIconBadge size={64} />
            <Text style={styles.readyTitle}>Ready to Start?</Text>
            <Text style={styles.readyText}>
              Please review all stops and trip details before starting your journey.
            </Text>
          </View>
          {[
            ["Total Stops", summary.stopsCount || 0],
            ["Distance", summary.distanceText || "--"],
            ["Estimated Time", summary.durationText || "--"],
            ["Vehicle Number", summary.vehicleNumber || summary.bus_number || "--"],
            ["Route", `${summary.startLabel} -> ${summary.endLabel}`],
          ].map(([label, value]) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
          <VayyButton
            fullWidth
            label={starting ? "Starting Trip..." : "Confirm & Start Trip"}
            loading={starting}
            onPress={onStartTrip}
            size="lg"
          />
        </VayyCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { gap: SPACING.base, padding: SPACING.base, paddingBottom: SPACING.xxl },
  overview: { gap: SPACING.md },
  overviewHead: { alignItems: "center", flexDirection: "row", gap: SPACING.md },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  fromTo: { alignItems: "center", flexDirection: "row", gap: SPACING.md },
  placeCol: { flex: 1 },
  placeRight: { alignItems: "flex-end" },
  place: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  time: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  arrow: { color: COLORS.textLight, fontSize: 13, fontWeight: "900" },
  metricRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  stopsCard: { gap: SPACING.md },
  cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  columnHeader: { flexDirection: "row", justifyContent: "space-between" },
  columnText: { color: COLORS.textLight, fontSize: 11, fontWeight: "800" },
  stopRow: { alignItems: "center", flexDirection: "row", gap: SPACING.md, minHeight: 58 },
  activeStop: { backgroundColor: COLORS.success, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
  stopArrival: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", width: 58 },
  stopTimeline: { alignItems: "center", width: 20 },
  stopDot: { backgroundColor: COLORS.borderMedium, borderRadius: RADIUS.full, height: 12, width: 12 },
  greenDot: { backgroundColor: COLORS.primary },
  redDot: { backgroundColor: COLORS.error },
  stopInfo: { flex: 1 },
  stopName: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  activeStopName: { color: COLORS.primary },
  stopSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  stopDeparture: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  summaryCard: { gap: SPACING.md },
  ready: { alignItems: "center", gap: SPACING.sm },
  readyTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  readyText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  summaryRow: {
    alignItems: "center",
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
  },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "700" },
  summaryValue: { color: COLORS.text, flex: 1, fontSize: 14, fontWeight: "900", textAlign: "right" },
});
