import React from "react";
import { Text, View } from "react-native";
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
import { Home, Map, Navigation, Bell, User } from "lucide-react-native";

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
    </Stack.Navigator>
  );
}
