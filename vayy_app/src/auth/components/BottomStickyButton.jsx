import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import COLORS from "../../shared/constants/colors";

export default function BottomStickyButton({ label, onPress, disabled, loading }) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      style={[styles.button, { marginBottom: insets.bottom + 16 }, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary, borderRadius: 18, height: 56,
    alignItems: "center", justifyContent: "center", marginHorizontal: 24,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  disabled: { opacity: 0.5 },
  label: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
});
