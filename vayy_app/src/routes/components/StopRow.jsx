import React from "react";
import { StyleSheet, Text, View } from "react-native";

import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SPACING from "../../shared/constants/spacing";
import StatusBadge from "../../shared/components/common/StatusBadge";

export default function StopRow({ stop, index, totalStops, isActive = false }) {
  const isFirst = index === 0;
  const isLast = index === totalStops - 1;
  const name = stop?.name || stop?.stop_name || `Stop ${index + 1}`;
  const city = stop?.city || stop?.area || "";
  const arrival = stop?.arrival_time || stop?.eta || "--";
  const departure = stop?.departure_time || "--";
  const status = isFirst ? "Boarding" : isLast ? "Drop-off" : stop?.status || "Upcoming";
  const isDrop = isLast || status === "Drop-off";

  return (
    <View style={[styles.row, isActive && styles.activeRow]}>
      <Text style={styles.time}>{arrival}</Text>
      <View style={styles.timeline}>
        {!isFirst ? <View style={styles.spineTop} /> : null}
        <View style={[styles.dot, isDrop && styles.dropDot, isActive && styles.activeDot]} />
        {!isLast ? <View style={styles.spineBottom} /> : null}
      </View>
      <View style={styles.details}>
        <Text style={[styles.name, isActive && styles.activeName]}>{name}</Text>
        {city ? <Text style={styles.city}>{city}</Text> : null}
      </View>
      <View style={styles.end}>
        <StatusBadge label={status} tone={isDrop ? "error" : "success"} />
        <Text style={styles.departure}>{departure}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 70,
    paddingHorizontal: SPACING.md,
  },
  activeRow: {
    backgroundColor: "rgba(0, 152, 73, 0.08)",
    borderRadius: RADIUS.md,
  },
  time: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    width: 52,
  },
  timeline: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    width: 26,
  },
  spineTop: {
    backgroundColor: COLORS.borderMedium,
    flex: 1,
    width: 2,
  },
  spineBottom: {
    backgroundColor: COLORS.borderMedium,
    flex: 1,
    width: 2,
  },
  dot: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    height: 12,
    width: 12,
  },
  dropDot: {
    backgroundColor: COLORS.error,
  },
  activeDot: {
    borderColor: COLORS.liveAccent,
    borderWidth: 3,
    height: 18,
    width: 18,
  },
  details: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  name: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  activeName: {
    color: COLORS.primary,
  },
  city: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  end: {
    alignItems: "flex-end",
    gap: SPACING.xs,
  },
  departure: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: "600",
  },
});
