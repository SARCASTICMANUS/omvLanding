import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

export default function VayyInput({
  label,
  placeholder,
  value,
  onChangeText,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  keyboardType = "default",
  error,
}) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, error && styles.inputError]}>
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          secureTextEntry={secureTextEntry}
          style={styles.input}
          value={value}
        />
        {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: COLORS.borderMedium,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    flexDirection: "row",
    minHeight: 52,
    paddingHorizontal: SPACING.base,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  input: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
    minHeight: 52,
  },
  error: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
});
