import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BadgeChip from "./BadgeChip";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function RouteCard({ route, accent = colors.primary, icon = "🛺", actionLabel = "Board", onPress }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.copy}>
          <Text style={styles.route}>{route.from} → {route.to}</Text>
          <Text style={styles.preview}>{route.stopPreview || route.distance}</Text>
        </View>
        <BadgeChip label={route.eta} accent={accent} />
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.fare}>{route.fare}</Text>
        <Text style={styles.stops}>{route.stops ? `${route.stops} stops` : route.distance}</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={onPress}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    fontSize: 28,
  },
  copy: {
    flex: 1,
  },
  route: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  preview: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.md,
  },
  fare: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "900",
  },
  stops: {
    flex: 1,
    color: colors.textSecondary,
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    color: colors.white,
    fontWeight: "900",
  },
});
