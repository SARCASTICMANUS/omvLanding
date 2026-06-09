import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import OTPInput from "../../components/OTPInput";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import Logo from "../../shared/components/common/Logo";
import PrimaryButton from "../../shared/components/common/PrimaryButton";

export function DriverLoginScreen({ navigation, mode = "auto" }) {
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.autoAccent;
  return (
    <AppFrame showBack={false}>
      <ScrollView contentContainerStyle={styles.page}>
        <Logo />
        <Text style={styles.heroSmall}>{isBike ? "Bike Driver Login" : "Driver Login"}</Text>
        <View style={styles.inputPanel}>
          <TextInput style={styles.input} placeholder="+91 Phone number" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
          <PrimaryButton label="Send OTP" accent={accent} />
          <OTPInput accent={accent} />
          <TextInput style={styles.input} placeholder="Vehicle No." placeholderTextColor={colors.textMuted} />
          <TextInput style={styles.input} value={isBike ? "Bike Type · Standard" : "Auto Type · Shared"} placeholderTextColor={colors.textMuted} />
        </View>
        <PrimaryButton label="Start Driving" accent={accent} onPress={() => navigation.navigate(isBike ? "BikeDriverFromTo" : "AutoDriverFromTo")} />
      </ScrollView>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  heroSmall: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  inputPanel: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
});
