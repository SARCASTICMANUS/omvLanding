import React from "react";
import { Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";

import COLORS from "../shared/constants/colors";
import DriverHomeScreen from "../driver/screens/DriverHomeScreen";
import DriverRouteList from "../routes/screens/DriverRouteList";
import DriverLiveTracking from "../tracking/screens/DriverLiveTracking";
import DriverTripReview from "../routes/screens/DriverTripReview";
import DriverActionsScreen from "../driver/screens/DriverActionsScreen";
import DriverTripHistoryScreen from "../driver/screens/DriverTripHistoryScreen";
import VehicleSelectionScreen from "../driver/screens/VehicleSelectionScreen";
import ProfileScreen from "../shared/screens/ProfileScreen";
import { LayoutDashboard, Map, User, Settings } from "lucide-react-native";

// Auto Flow Screens
import AutoAheadAlertScreen from "../auto/screens/AutoAheadAlertScreen";
import AutoBoardedPopupScreen from "../auto/screens/AutoBoardedPopupScreen";
import { FindPassengerScreen as AutoFindPassengerScreen } from "../auto/screens/AutoFindPassengerScreen";
import AutoLiveTrackingScreen from "../auto/screens/AutoLiveTrackingScreen";

// Bike Flow Screens
import { FindRideBuddyScreen as BikeSearchingScreen } from "../bike/screens/BikeSearchingScreen";
import { BuddyRequestPopupScreen } from "../bike/screens/BikeBookingScreen";
import BikeOTPHandshakeScreen from "../bike/screens/BikeOTPHandshakeScreen";
import BikeTrackingScreen from "../bike/screens/BikeTrackingScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();


function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 10,
        },
      }}
    >
      <Tab.Screen name="DriverHomeScreen" component={DriverHomeScreen} options={{ title: "Console", tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} /> }} />
      <Tab.Screen name="DriverRouteList" component={DriverRouteList} options={{ title: "Routes", tabBarIcon: ({ color, size }) => <Map size={size} color={color} /> }} />
      <Tab.Screen name="DriverActions" component={DriverActionsScreen} options={{ title: "Actions", tabBarIcon: ({ color, size }) => <Settings size={size} color={color} /> }} />
      <Tab.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function DriverNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverTabs" component={DriverTabs} />
      <Stack.Screen name="DriverTripReview" component={DriverTripReview} />
      <Stack.Screen name="DriverLiveTracking" component={DriverLiveTracking} />
      <Stack.Screen name="DriverTripHistoryScreen" component={DriverTripHistoryScreen} />
      <Stack.Screen name="VehicleSelectionScreen" component={VehicleSelectionScreen} />
      <Stack.Screen name="FindPassenger" component={AutoFindPassengerScreen} />
      <Stack.Screen name="AheadAlert" component={AutoAheadAlertScreen} />
      <Stack.Screen name="BoardedPopup" component={AutoBoardedPopupScreen} />
      <Stack.Screen name="AutoRideActive" component={AutoLiveTrackingScreen} />
      <Stack.Screen name="BikeSearching" component={BikeSearchingScreen} />
      <Stack.Screen name="BuddyRequestPopup" component={BuddyRequestPopupScreen} />
      <Stack.Screen name="BikeOTPHandshake" component={BikeOTPHandshakeScreen} />
      <Stack.Screen name="BikeTracking" component={BikeTrackingScreen} />
    </Stack.Navigator>
  );
}
