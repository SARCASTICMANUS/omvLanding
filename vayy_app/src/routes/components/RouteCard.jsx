import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SHADOW from "../../shared/constants/shadow";
import SPACING from "../../shared/constants/spacing";
import VehicleIconBadge from "../../shared/components/common/VehicleIconBadge";
import LiveDot from "../../shared/components/common/LiveDot";
import MetricChip from "../../shared/components/common/MetricChip";
import RouteLine from "../../shared/components/common/RouteLine";
import StatusBadge from "../../shared/components/common/StatusBadge";

const pick = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

export default function RouteCard({ trip, onPress }) {
  const routeCode = pick(trip?.route_code, trip?.vehicle_number, trip?.vehicle?.number, null);
  const eta = pick(trip?.eta_minutes, trip?.eta, trip?.next_stop_eta, "--");
  const from = pick(trip?.source_name, trip?.origin, trip?.from, "Pickup");
  const to = pick(trip?.destination_name, trip?.destination, trip?.to, "Destination");
  const distance = pick(trip?.distance_text, trip?.total_distance, trip?.distance, "--");
  const stops = pick(trip?.stops_count, trip?.stops?.length, "--");

  return (
    <TouchableOpacity activeOpacity={0.86} onPress={() => onPress?.(trip)} style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <VehicleIconBadge size={68} vehicleType={trip?.vehicle_type || "auto"} />
          <View style={styles.liveBadge}>
            <LiveDot size={6} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.metaRow}>
            <Text style={styles.vehicleLabel}>Vehicle No.</Text>
            <StatusBadge label="On Time" />
          </View>
          <View style={styles.numberRow}>
            <Text style={styles.routeCode}>{routeCode}</Text>
            <Text style={styles.chevron}>&gt;</Text>
          </View>
          <Text style={styles.eta}>{eta} min</Text>
        </View>
      </View>

      <View style={styles.routeBlock}>
        <RouteLine progress={trip?.progress ?? 0} />
        <View style={styles.placeRow}>
          <Text numberOfLines={1} style={styles.placeText}>{from}</Text>
          <Text numberOfLines={1} style={styles.placeText}>{to}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <MetricChip value={distance} label="Distance" />
        <MetricChip value={stops} label="Stops" />
        {trip?.vehicle_type ? <MetricChip value={trip.vehicle_type} label="Type" /> : null}
        {trip?.via || trip?.via_route ? <MetricChip value={trip.via || trip.via_route} label="Route" green /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    ...SHADOW.sm,
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.base,
  },
  topRow: {
    flexDirection: "row",
    gap: SPACING.base,
  },
  liveBadge: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.full,
    flexDirection: "row",
    gap: 4,
    marginTop: -10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "900",
  },
  info: {
    flex: 1,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  vehicleLabel: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  numberRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.xs,
  },
  routeCode: {
    color: COLORS.black,
    fontSize: 18,
    fontWeight: "900",
  },
  chevron: {
    color: COLORS.textMuted,
    fontSize: 28,
  },
  eta: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: "900",
    marginTop: SPACING.xs,
  },
  routeBlock: {
    marginTop: SPACING.base,
  },
  placeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  placeText: {
    color: COLORS.textSecondary,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.base,
  },
});
