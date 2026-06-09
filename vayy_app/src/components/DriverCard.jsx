import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AvatarCircle from "./AvatarCircle";
import BadgeChip from "./BadgeChip";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function DriverCard({ driver, accent = colors.primary }) {
  const initials = driver.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return (
    <View style={styles.card}>
      <AvatarCircle initials={initials} accent={accent} />
      <View style={styles.copy}>
        <Text style={styles.name}>{driver.name}</Text>
        <Text style={styles.meta}>{driver.vehicleNo}</Text>
        <View style={styles.row}>
          <BadgeChip label={driver.gender} accent={accent} />
          <Text style={styles.rating}>★ {driver.rating}</Text>
        </View>
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
    flexDirection: "row",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  meta: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rating: {
    color: colors.textPrimary,
    fontWeight: "800",
  },
});
