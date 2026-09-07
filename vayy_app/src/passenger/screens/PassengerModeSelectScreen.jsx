import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import AppFrame from "../../components/AppFrame";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function PassengerModeSelectScreen({ navigation }) {
  return (
    <AppFrame navigation={navigation} title="Passenger" showBack={false}>
      <View style={styles.page}>
        <Text style={styles.hero}>How are you travelling?</Text>
        <View style={styles.cardStack}>
          <TouchableOpacity style={styles.roleCard} onPress={() => navigation.navigate("SharedAutoHome")}>
            <Image source={require('../../../assets/vayySideAuto-small.webp')} style={styles.roleIcon} />
            <Text style={styles.roleTitle}>Shared Auto</Text>
            <Text style={styles.roleMeta}>Stop based boarding and live autos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleCard} onPress={() => navigation.navigate("BikeRideHome")}>
            <Image source={require('../../../assets/vayyPulsureBike-small.webp')} style={styles.roleIcon} />
            <Text style={styles.roleTitle}>Bike Ride</Text>
            <Text style={styles.roleMeta}>Quick bike buddy pickup flow</Text>
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
    width: 50,
    height: 50,
    resizeMode: "contain",
    alignSelf: "center",
    marginBottom: spacing.xs,
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
