import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

export default function VayyButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  icon,
  fullWidth = false,
}) {
  const isPrimary = variant === "primary";

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        styles[size],
        styles[variant],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? COLORS.white : COLORS.primary} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: RADIUS.md,
    justifyContent: "center",
  },
  sm: {
    height: 40,
    paddingHorizontal: SPACING.base,
  },
  md: {
    height: 48,
    paddingHorizontal: SPACING.lg,
  },
  lg: {
    height: 56,
    paddingHorizontal: SPACING.xl,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  outline: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryLabel: {
    color: COLORS.white,
  },
  secondaryLabel: {
    color: COLORS.primary,
  },
});
