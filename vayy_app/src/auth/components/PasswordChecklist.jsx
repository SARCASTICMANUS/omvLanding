import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PASSWORD_RULES } from "../validators";
import COLORS from "../../shared/constants/colors";

export default function PasswordChecklist({ password }) {
  return (
    <View style={styles.container}>
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password || "");
        return (
          <View key={rule.key} style={styles.row}>
            <View style={[styles.dot, passed && styles.dotPassed]}>
              {passed && <Text style={styles.check}>✓</Text>}
            </View>
            <Text style={[styles.label, passed && styles.labelPassed]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  dotPassed: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  check: { color: "#fff", fontSize: 10, fontWeight: "800" },
  label: { fontSize: 12, color: COLORS.textMuted },
  labelPassed: { color: COLORS.primary, fontWeight: "600" },
});
