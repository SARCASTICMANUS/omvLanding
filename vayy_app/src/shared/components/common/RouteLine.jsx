import React from "react";
import { StyleSheet, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";

export default function RouteLine({ progress = 45 }) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <View style={styles.container}>
      <View style={styles.startDot} />
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clampedProgress}%` }]} />
        <View style={[styles.busMarker, { left: `${clampedProgress}%` }]}>
          <View style={styles.busGlyph} />
        </View>
      </View>
      <View style={styles.endDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    height: 34,
    width: "100%",
  },
  startDot: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    height: 12,
    width: 12,
  },
  track: {
    borderColor: COLORS.borderMedium,
    borderStyle: "dashed",
    borderTopWidth: 2,
    flex: 1,
    height: 2,
    marginHorizontal: 6,
  },
  fill: {
    backgroundColor: COLORS.primary,
    height: 2,
    left: 0,
    position: "absolute",
    top: -2,
  },
  busMarker: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    height: 26,
    justifyContent: "center",
    marginLeft: -13,
    position: "absolute",
    top: -14,
    width: 26,
  },
  busGlyph: {
    backgroundColor: COLORS.primary,
    borderRadius: 3,
    height: 10,
    width: 12,
  },
  endDot: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.error,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
});
