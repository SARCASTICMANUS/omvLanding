import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppFrame from "../components/AppFrame";
import Logo from "../shared/components/common/Logo";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export function RoleSelectScreen({ navigation }) {
  return (
    <AppFrame showBack={false}>
      <View style={styles.page}>
        <Logo />
        <Text style={styles.hero}>Choose your VAYY mode</Text>
        <Text style={styles.muted}>Shared autos, bike rides, and driver flows are ready with local dummy data.</Text>
        <View style={styles.cardStack}>
          <TouchableOpacity style={styles.roleCard} onPress={() => navigation.navigate("PassengerNavigator")}>
            <Text style={styles.roleIcon}>🧍</Text>
            <Text style={styles.roleTitle}>Passenger</Text>
            <Text style={styles.roleMeta}>Book shared auto or bike rides</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleCard} onPress={() => navigation.navigate("AutoDriverNavigator")}>
            <Text style={styles.roleIcon}>🛺</Text>
            <Text style={styles.roleTitle}>Auto Driver</Text>
            <Text style={styles.roleMeta}>Find passengers on your route</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleCard} onPress={() => navigation.navigate("BikeDriverNavigator")}>
            <Text style={styles.roleIcon}>🏍️</Text>
            <Text style={styles.roleTitle}>Bike Driver</Text>
            <Text style={styles.roleMeta}>Match with ride buddies</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  hero: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  cardStack: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  roleCard: {
    minHeight: 112,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    justifyContent: "center",
  },
  roleIcon: {
    fontSize: 30,
  },
  roleTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  roleMeta: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});

export default RoleSelectScreen;
