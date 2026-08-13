import React from "react";
import { View, Text, StyleSheet } from "react-native";
import COLORS from "../../shared/constants/colors";

export default function ProgressBar({ current, total }) {
  const pct = `${(current / total) * 100}%`;
  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: pct }]} />
      </View>
      <Text style={styles.label}>Step {current} of {total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  track: { flex: 1, height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: COLORS.primary, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
});
