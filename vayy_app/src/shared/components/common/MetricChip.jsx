import React from "react";
import { StyleSheet, Text, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

export default function MetricChip({ icon, value, label, green = false }) {
  return (
    <View style={[styles.chip, green && styles.greenChip]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View>
        <Text style={[styles.value, green && styles.greenText]}>{value}</Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  greenChip: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.successBorder,
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  greenText: {
    color: COLORS.primary,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});
