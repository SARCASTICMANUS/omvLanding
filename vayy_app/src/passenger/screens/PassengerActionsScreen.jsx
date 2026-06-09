import React from "react";
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function PassengerActionsScreen({ navigation }) {
  const actions = [
    { title: "Trip Planner", screen: "PassengerTripPlanner" },
    { title: "Routes", screen: "PassengerRoutes" },
    { title: "Alerts", screen: "PassengerAlerts" },
    { title: "Journey History", screen: "JourneyHistoryScreen" },
    { title: "Find Destination", screen: "DestinationSearchScreen" },
    { title: "Live Tracking", screen: "PassengerLiveTracking" },
    { title: "Route List", screen: "PassengerRouteList" },
    { title: "Bike Map Pre-Ride", screen: "BikeMapPreRide" },
    { title: "Bike Map Post-Accept", screen: "BikeMapPostAccept" },
    { title: "Rider Popup", screen: "RiderPopup" },
    { title: "Ride Stats", screen: "RideStats" },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.header}>Passenger Actions</Text>
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
