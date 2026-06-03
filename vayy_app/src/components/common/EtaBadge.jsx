import React from "react";
import { StyleSheet, Text, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

export default function EtaBadge({ minutes, size = "md" }) {
  return (
    <View style={[styles.badge, styles[size]]}>
      <Text style={[styles.text, size === "sm" && styles.smallText]}>
        Arrives in {minutes ?? "--"} min
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.success,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  sm: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  md: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  text: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  smallText: {
    fontSize: 11,
  },
});
