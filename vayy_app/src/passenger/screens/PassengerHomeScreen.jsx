import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import BadgeChip from "../../components/BadgeChip";
import MapPlaceholder from "../../components/MapPlaceholder";
import Logo from "../../shared/components/common/Logo";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function PassengerHomeScreen({ navigation, mode = "auto" }) {
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.primary;
  return (
    <AppFrame showBack={false}>
      <View style={styles.home}>
        <View style={styles.homeTop}>
          <Logo />
          <Text style={styles.greeting}>Good morning, Arjun</Text>
        </View>
        <MapPlaceholder accent={accent} vehicle={isBike ? "🏍️" : "🛺"} />
        <View style={styles.bottomSheet}>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, !isBike && { borderBottomColor: colors.primary }]} onPress={() => navigation.navigate("SharedAutoHome")}>
              <Text style={[styles.tabText, !isBike && { color: colors.primary }]}>Shared Auto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, isBike && { borderBottomColor: colors.bikeAccent }]} onPress={() => navigation.navigate("BikeRideHome")}>
              <Text style={[styles.tabText, isBike && { color: colors.bikeAccent }]}>Bike Ride</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate(isBike ? "BikeFromTo" : "SharedAutoFromTo")}>
            <Text style={styles.searchText}>Where do you want to go?</Text>
          </TouchableOpacity>
          <View style={styles.chips}>
            {["Home", "Office", "Railway Station"].map((label) => <BadgeChip key={label} label={label} accent={accent} />)}
          </View>
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  home: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  homeTop: {
    gap: spacing.sm,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.md,
  },
  tabs: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  tabText: {
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: "900",
  },
  searchBar: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  searchText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
