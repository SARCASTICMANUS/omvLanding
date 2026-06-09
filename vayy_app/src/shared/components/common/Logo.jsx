import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";

export default function Logo() {
  return (
    <View style={styles.logoRow}>
      <View style={styles.logoMark}>
        <Text style={styles.logoGlyph}>V</Text>
      </View>
      <Text style={styles.logoText}>VAYY</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 20,
  },
  logoText: {
    color: colors.textPrimary,
    fontWeight: "900",
    fontSize: 24,
  },
});
