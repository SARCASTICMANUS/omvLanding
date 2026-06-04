import React from "react";
import { StyleSheet, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";

export default function BusIconBadge({ size = 48 }) {
  return (
    <View style={[styles.badge, { height: size, width: size }]}>
      <View style={styles.busBody}>
        <View style={styles.windowRow}>
          <View style={styles.window} />
          <View style={styles.window} />
        </View>
      </View>
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
  busBody: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    height: 22,
    padding: 4,
    width: 26,
  },
  windowRow: {
    flexDirection: "row",
    gap: 3,
  },
  window: {
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    flex: 1,
    height: 7,
  },
});
