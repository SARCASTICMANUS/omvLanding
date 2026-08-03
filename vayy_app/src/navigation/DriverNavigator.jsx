import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";

import COLORS from "../shared/constants/colors";
import DriverModeSelectScreen from "../driver/screens/DriverModeSelectScreen";
import DriverBikeHomeScreen from "../driver/bike-ride/DriverBikeHomeScreen";
import DriverRouteList from "../driver/screens/DriverRouteList";
import DriverFindPassengersScreen from "../driver/screens/DriverFindPassengersScreen";
import DriverLiveTracking from "../driver/screens/DriverLiveTracking";
import DriverTripReview from "../driver/screens/DriverTripReview";
import DriverTripHistoryScreen from "../driver/screens/DriverTripHistoryScreen";
import ProfileScreen from "../shared/screens/ProfileScreen";
import EditProfileScreen from "../shared/screens/EditProfileScreen";
import BikeFindPassengerScreen from "../driver/bike-ride/BikeFindPassengerScreen";

// Auto Flow Screens
import DriverAutoHomeScreen from "../driver/shared-auto/DriverAutoHomeScreen";
import AutoFindPassengerScreen from "../driver/shared-auto/AutoFindPassengerScreen";
import AutoRideToPickupScreen from "../driver/shared-auto/AutoRideToPickupScreen";
import AutoRideToDestinationScreen from "../driver/shared-auto/AutoRideToDestinationScreen";
import AutoTripCompleteScreen from "../driver/shared-auto/AutoTripCompleteScreen";
import { LayoutDashboard, Map, User } from "lucide-react-native";

// Auto Flow Screens (for future)
import AutoAheadAlertScreen from "../driver/shared-auto/AutoAheadAlertScreen";
import AutoBoardedPopupScreen from "../driver/shared-auto/AutoBoardedPopupScreen";
import AutoLiveTrackingScreen from "../driver/shared-auto/AutoLiveTrackingScreen";

// Bike Flow Screens
import { BikeSearchingScreen } from "../passenger/bike-ride/BikeSearchingScreen";
import BikeOTPEntryScreen from "../driver/bike-ride/BikeOTPEntryScreen";
import VehicleSelectionScreen from "../driver/screens/VehicleSelectionScreen";
import BikeRideToPickupScreen from "../driver/bike-ride/BikeRideToPickupScreen";
import BikeRideToDestinationScreen from "../driver/bike-ride/BikeRideToDestinationScreen";
import BikeTripCompleteScreen from "../driver/bike-ride/BikeTripCompleteScreen";
import TripEndSummary from "../routes/screens/TripEndSummary";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();


function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          height: 58,
          paddingBottom: 8,
          paddingTop: 4,
          position: "absolute",
        },
      }}
    >
      <Tab.Screen name="DriverModeSelect" component={DriverModeSelectScreen} options={{ title: "Home", tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} /> }} />
      <Tab.Screen name="DriverRoutes" component={DriverRouteList} options={{ title: "Routes", tabBarIcon: ({ color, size }) => <Map size={size} color={color} /> }} />
      <Tab.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function DriverNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverTabs" component={DriverTabs} />
      <Stack.Screen name="DriverBikeHome" component={DriverBikeHomeScreen} />
      <Stack.Screen name="DriverTripReview" component={DriverTripReview} />
      <Stack.Screen name="DriverLiveTracking" component={DriverLiveTracking} />
      <Stack.Screen name="DriverTripHistoryScreen" component={DriverTripHistoryScreen} />
      <Stack.Screen name="VehicleSelectionScreen" component={VehicleSelectionScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="FindPassenger" component={BikeFindPassengerScreen} />
      <Stack.Screen name="DriverFindPassengers" component={DriverFindPassengersScreen} />
      <Stack.Screen name="AheadAlert" component={AutoAheadAlertScreen} />
      <Stack.Screen name="BoardedPopup" component={AutoBoardedPopupScreen} />
      <Stack.Screen name="AutoRideActive" component={AutoLiveTrackingScreen} />
      <Stack.Screen name="BikeSearching" component={BikeSearchingScreen} />
      <Stack.Screen name="BikeOTPEntry" component={BikeOTPEntryScreen} />
      <Stack.Screen name="BikeRideToPickup" component={BikeRideToPickupScreen} />
      <Stack.Screen name="BikeRideToDestination" component={BikeRideToDestinationScreen} />
      <Stack.Screen name="BikeTripComplete" component={BikeTripCompleteScreen} />
      <Stack.Screen name="TripEndSummary" component={TripEndSummary} />
      <Stack.Screen name="DriverAutoHome" component={DriverAutoHomeScreen} />
      <Stack.Screen name="AutoFindPassenger" component={AutoFindPassengerScreen} />
      <Stack.Screen name="AutoRideToPickup" component={AutoRideToPickupScreen} />
      <Stack.Screen name="AutoRideToDestination" component={AutoRideToDestinationScreen} />
      <Stack.Screen name="AutoTripComplete" component={AutoTripCompleteScreen} />
    </Stack.Navigator>
  );
}
