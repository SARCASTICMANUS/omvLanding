import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";

export default function VehicleIconBadge({ size = 48, vehicleType = "auto" }) {
  const icon = "bicycle";
  const iconSize = size * 0.5;

  return (
    <View style={[styles.badge, { height: size, width: size }]}>
      <Ionicons name={icon} size={iconSize} color={COLORS.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: "center",
  },
});
