import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView from "react-native-maps";
import AppFrame from "../../components/AppFrame";
import BadgeChip from "../../components/BadgeChip";
import Logo from "../../shared/components/common/Logo";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function PassengerHomeScreen({ navigation, mode = "auto" }) {
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.primary;
  return (
    <AppFrame showBack={false}>
      <View style={styles.home}>
        <MapView
          style={styles.mapBg}
          initialRegion={{
            latitude: 26.8467,
            longitude: 80.9462,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        />
        <View style={styles.homeTop}>
          <Logo />
          <Text style={styles.greeting}>Good morning, Arjun</Text>
        </View>
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
    position: "relative",
  },
  homeTop: {
    gap: spacing.sm,
    zIndex: 2,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    overflow: "hidden",
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
