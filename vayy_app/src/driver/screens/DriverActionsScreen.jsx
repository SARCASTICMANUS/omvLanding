import React from "react";
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function DriverActionsScreen({ navigation }) {
  const actions = [
    { title: "Driver Console", screen: "DriverHomeScreen" },
    { title: "Routes", screen: "DriverRouteList" },
    { title: "Trip History", screen: "DriverTripHistoryScreen" },
    { title: "Vehicle Selection", screen: "VehicleSelectionScreen" },
    { title: "Find Passenger", screen: "FindPassenger" },
    { title: "Ahead Alert", screen: "AheadAlert" },
    { title: "Boarded Popup", screen: "BoardedPopup" },
    { title: "Ride Active", screen: "AutoRideActive" },
    { title: "Bike Searching", screen: "BikeSearching" },
    { title: "Buddy Request Popup", screen: "BuddyRequestPopup" },
    { title: "Bike OTP Handshake", screen: "BikeOTPHandshake" },
    { title: "Bike Tracking", screen: "BikeTracking" },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.header}>Driver Actions</Text>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.title}
            style={styles.button}
            onPress={() => navigation.navigate(action.screen)}
          >
            <Text style={styles.buttonText}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
    gap: spacing.md,
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: spacing.md,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
