import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";

export default function PrimaryButton({ label, onPress, accent = colors.primary, outline = false, danger = false }) {
  const color = danger ? colors.danger : accent;
  return (
    <TouchableOpacity style={[styles.button, outline && styles.outlineButton, { backgroundColor: outline ? "transparent" : color, borderColor: color }]} onPress={onPress}>
      <Text style={[styles.buttonText, outline && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  outlineButton: {
    backgroundColor: "transparent",
  },
  buttonText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 15,
  },
});
