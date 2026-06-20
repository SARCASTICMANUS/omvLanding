import React, { lazy, Suspense } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";

import COLORS from "../shared/constants/colors";
import AllBusesPage from "../routes/screens/AllBusesPage";
import IntroPage from "../passenger/screens/IntroPage";
import PassengerRouteList from "../routes/screens/PassengerRouteList";
import PassengerLiveTracking from "../tracking/screens/PassengerLiveTracking";
import PassengerStopsTimeline from "../routes/screens/PassengerStopsTimeline";
import PassengerTripPlanner from "../passenger/screens/PassengerTripPlanner";
import ProfileScreen from "../shared/screens/ProfileScreen";
import PassengerAlertsScreen from "../handshake/screens/PassengerAlertsScreen";
import PassengerActionsScreen from "../passenger/screens/PassengerActionsScreen";
import JourneyHistoryScreen from "../passenger/screens/JourneyHistoryScreen";
import DestinationSearchScreen from "../passenger/screens/DestinationSearchScreen";
const DeveloperNavigator = lazy(() => import("../screens/Developer/DeveloperNavigator"));
import { Home, Map, Navigation, Bell, User, Settings } from "lucide-react-native";

// Bike Flow Screens
import { BikeMapPreRideScreen } from "../passenger/bike-ride/MapPreRideScreen";
import { BikeMapPostAcceptScreen } from "../passenger/bike-ride/MapPostAcceptScreen";
import { RiderPopupScreen } from "../passenger/bike-ride/RiderPopupScreen";
import { RideStatsScreen } from "../passenger/bike-ride/RideStatsScreen";
import { BikeSearchingScreen } from "../passenger/bike-ride/BikeSearchingScreen";
import { RideCompleteScreen } from "../passenger/bike-ride/RideCompleteScreen";

// Auto Flow Screens
import { AutoPreRideScreen } from "../passenger/shared-auto/AutoPreRideScreen";
import { AutoSearchingScreen } from "../passenger/shared-auto/AutoSearchingScreen";
import { AutoRideCompleteScreen } from "../passenger/shared-auto/AutoRideCompleteScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function PassengerTabs() {
  return (
    <Tab.Navigator
      initialRouteName="PassengerTripPlanner"
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
        component={AllBusesPage}
        options={{ title: "Routes", tabBarIcon: ({ color, size }) => <Map size={size} color={color} /> }}
      />
      <Tab.Screen
        name="PassengerTripPlanner"
        component={PassengerTripPlanner}
        options={{ title: "Live Map", tabBarIcon: ({ color, size }) => <Navigation size={size} color={color} /> }}
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
      <Stack.Screen name="AllBusesPage" component={AllBusesPage} />
      <Stack.Screen name="PassengerStopsTimeline" component={PassengerStopsTimeline} />
      <Stack.Screen name="PassengerLiveTracking" component={PassengerLiveTracking} />
      <Stack.Screen name="JourneyHistoryScreen" component={JourneyHistoryScreen} />
      <Stack.Screen name="DestinationSearchScreen" component={DestinationSearchScreen} />
      
      {/* Bike Flow */}
      <Stack.Screen name="BikeMapPreRide" component={BikeMapPreRideScreen} />
      <Stack.Screen name="BikeMapPostAccept" component={BikeMapPostAcceptScreen} />
      <Stack.Screen name="RiderPopup" component={RiderPopupScreen} />
      <Stack.Screen name="RideStats" component={RideStatsScreen} />
      <Stack.Screen name="BikeSearching" component={BikeSearchingScreen} />
      <Stack.Screen name="RideComplete" component={RideCompleteScreen} />

      {/* Auto Flow */}
      <Stack.Screen name="AutoPreRide" component={AutoPreRideScreen} />
      <Stack.Screen name="AutoSearching" component={AutoSearchingScreen} />
      <Stack.Screen name="AutoRideComplete" component={AutoRideCompleteScreen} />
    </Stack.Navigator>
  );
}
