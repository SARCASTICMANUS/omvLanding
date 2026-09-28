import React from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function PassengerActionsScreen({ navigation }) {
  // Moved Bike Search to the TOP for easier access
  const actions = [
    { title: "Bike Search State", screen: "BikeSearching" },
    { title: "Bike Map Pre-Ride", screen: "BikeMapPreRide" },
    { title: "Marshal Popup (Accepted)", screen: "RiderPopup" },
    { title: "Ride Stats (In-Ride)", screen: "RideStats" },
    { title: "Trip Planner", screen: "PassengerTripPlanner" },
    { title: "Routes", screen: "PassengerRoutes" },
    { title: "Alerts", screen: "PassengerAlerts" },
    { title: "Journey History", screen: "JourneyHistoryScreen" },
    { title: "Find Destination", screen: "DestinationSearchScreen" },
    { title: "Live Tracking", screen: "PassengerLiveTracking" },
    { title: "Ride Complete", screen: "RideComplete" },
    { title: "Route List", screen: "PassengerRouteList" },
    { title: "Auto Pre-Ride", screen: "AutoPreRide" },
    { title: "Auto Search State", screen: "AutoSearching" },
    { title: "Auto Ride Complete", screen: "AutoRideComplete" },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={styles.header}>Passenger Dev Actions</Text>
          
          <View style={styles.grid}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.title}
                style={styles.button}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100, // Extra space for bottom tabs
  },
  container: {
    padding: spacing.md,
  },
  header: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    textAlign: "center",
    color: colors.text,
  },
  grid: {
    gap: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
});
