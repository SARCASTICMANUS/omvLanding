import React from "react";
import { StyleSheet, Text, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

export default function StatusBadge({ label = "On Time", tone = "success" }) {
  const isError = tone === "error";

  return (
    <View style={[styles.badge, isError && styles.errorBadge]}>
      <Text style={[styles.text, isError && styles.errorText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  errorBadge: {
    backgroundColor: COLORS.errorLight,
    borderColor: "#fecaca",
  },
  text: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  errorText: {
    color: COLORS.error,
  },
});
