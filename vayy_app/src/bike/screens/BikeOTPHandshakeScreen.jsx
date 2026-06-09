import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import PrimaryButton from "../../shared/components/common/VayyButton"; // Using VayyButton as primary
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function BikeOTPHandshakeScreen({ navigation }) {
  return (
    <AppFrame navigation={navigation} title="OTP handshake" accent={colors.bikeAccent}>
      <View style={styles.pageCentered}>
        <Text style={styles.otpDisplay}>4286</Text>
        <Text style={styles.muted}>Confirm this code with your ride buddy</Text>
        <PrimaryButton 
          label="Confirm OTP" 
          onPress={() => navigation.navigate("BikeRideActive")} 
          style={{ backgroundColor: colors.bikeAccent }}
        />
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  pageCentered: {
    flex: 1,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  otpDisplay: {
    ...typography.mono,
    color: colors.textPrimary,
    fontSize: 40,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
