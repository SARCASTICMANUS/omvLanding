import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";

import COLORS from "../shared/constants/colors";
import IntroPage from "../passenger/screens/IntroPage";
import MyRoutesScreen from "../passenger/screens/MyRoutesScreen";
import PassengerRouteList from "../routes/screens/PassengerRouteList";
import PassengerLiveTracking from "../tracking/screens/PassengerLiveTracking";
import PassengerTripPlanner from "../passenger/screens/PassengerTripPlanner";
import ProfileScreen from "../shared/screens/ProfileScreen";
import EditProfileScreen from "../shared/screens/EditProfileScreen";
import PassengerAlertsScreen from "../handshake/screens/PassengerAlertsScreen";
import PassengerActionsScreen from "../passenger/screens/PassengerActionsScreen";
import JourneyHistoryScreen from "../passenger/screens/JourneyHistoryScreen";
import DestinationSearchScreen from "../passenger/screens/DestinationSearchScreen";
import { Home, Map, Navigation, Bell, User } from "lucide-react-native";

// Bike Flow Screens
import { BikeMapPreRideScreen } from "../passenger/bike-ride/MapPreRideScreen";
import { RiderPopupScreen } from "../passenger/bike-ride/RiderPopupScreen";
import { RideStatsScreen } from "../passenger/bike-ride/RideStatsScreen";
import { BikeSearchingScreen } from "../passenger/bike-ride/BikeSearchingScreen";
import { RideCompleteScreen } from "../passenger/bike-ride/RideCompleteScreen";

// Auto Flow Screens
import { AutoPreRideScreen } from "../passenger/shared-auto/AutoPreRideScreen";
import { AutoSearchingScreen } from "../passenger/shared-auto/AutoSearchingScreen";
import { AutoDiscoveryScreen } from "../passenger/shared-auto/AutoDiscoveryScreen";
import { AutoRideActiveScreen } from "../passenger/shared-auto/AutoRideActiveScreen";
import { AutoRideCompleteScreen } from "../passenger/shared-auto/AutoRideCompleteScreen";
import { SharedAutoMapScreen } from "../passenger/shared-auto/MapScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function PassengerTabs() {
  return (
    <Tab.Navigator
      initialRouteName="PassengerHome"
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
      <Tab.Screen
        name="PassengerHome"
        component={IntroPage}
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }}
      />
      <Tab.Screen
        name="PassengerRoutes"
        component={MyRoutesScreen}
        options={{ title: "Routes", tabBarIcon: ({ color, size }) => <Map size={size} color={color} /> }}
      />
      <Tab.Screen
        name="PassengerAlerts"
        component={PassengerAlertsScreen}
        options={{ title: "Alerts", tabBarIcon: ({ color, size }) => <Bell size={size} color={color} /> }}
      />
      <Tab.Screen
        name="PassengerActions"
        component={PassengerActionsScreen}
        options={{ title: "Actions", tabBarIcon: ({ color, size }) => <Navigation size={size} color={color} /> }}
      />
      <Tab.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function PassengerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PassengerTabs" component={PassengerTabs} />
      <Stack.Screen name="PassengerRouteList" component={PassengerRouteList} />
      <Stack.Screen name="PassengerLiveTracking" component={PassengerLiveTracking} />
      <Stack.Screen name="JourneyHistoryScreen" component={JourneyHistoryScreen} />
      <Stack.Screen name="DestinationSearchScreen" component={DestinationSearchScreen} />
      <Stack.Screen name="PassengerTripPlanner" component={PassengerTripPlanner} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      
      {/* Bike Flow */}
      <Stack.Screen name="BikeMapPreRide" component={BikeMapPreRideScreen} />
      <Stack.Screen name="RiderPopup" component={RiderPopupScreen} />
      <Stack.Screen name="RideStats" component={RideStatsScreen} />
      <Stack.Screen name="BikeSearching" component={BikeSearchingScreen} />
      <Stack.Screen name="RideComplete" component={RideCompleteScreen} />

      {/* Auto Flow */}
      <Stack.Screen name="AutoPreRide" component={AutoPreRideScreen} />
      <Stack.Screen name="AutoSearching" component={AutoSearchingScreen} />
      <Stack.Screen name="AutoDiscovery" component={AutoDiscoveryScreen} />
      <Stack.Screen name="AutoRideActive" component={AutoRideActiveScreen} />
      <Stack.Screen name="AutoRideComplete" component={AutoRideCompleteScreen} />
      <Stack.Screen name="SharedAutoMap" component={SharedAutoMapScreen} />
    </Stack.Navigator>
  );
}
