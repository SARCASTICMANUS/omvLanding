import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function BadgeChip({ label, accent = colors.primary }) {
  return (
    <View style={[styles.chip, { borderColor: accent }]}>
      <Text style={[styles.text, { color: accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
  },
});
