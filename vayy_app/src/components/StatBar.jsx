import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function StatBar({ stats, accent = colors.primary }) {
  return (
    <View style={styles.panel}>
      {stats.map((item, index) => (
        <View key={item.label} style={[styles.cell, index > 0 && styles.separator]}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={[styles.value, { color: index === 0 ? accent : colors.textPrimary }]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "33.333%",
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  separator: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  value: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "800",
  },
});
