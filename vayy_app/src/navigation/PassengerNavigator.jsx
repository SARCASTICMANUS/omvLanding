import React from "react";
import { Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";

import COLORS from "../constants/colors";
import AllBusesPage from "../screens/passenger/AllBusesPage";
import IntroPage from "../screens/passenger/IntroPage";
import PassengerRouteList from "../screens/passenger/PassengerRouteList";
import PassengerLiveTracking from "../screens/passenger/PassengerLiveTracking";
import PassengerStopsTimeline from "../screens/passenger/PassengerStopsTimeline";
import PassengerTripPlanner from "../screens/passenger/PassengerTripPlanner";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const PlaceholderScreen = ({ route }) => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <Text>{route.name}</Text>
  </View>
);

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
        options={{ title: "Home", tabBarIcon: ({ color }) => <Text style={{ color }}>H</Text> }}
      />
      <Tab.Screen
        name="PassengerRoutes"
        component={AllBusesPage}
        options={{ title: "Routes", tabBarIcon: ({ color }) => <Text style={{ color }}>R</Text> }}
      />
      <Tab.Screen
        name="PassengerTripPlanner"
        component={PassengerTripPlanner}
        options={{ title: "Live Map", tabBarIcon: ({ color }) => <Text style={{ color }}>M</Text> }}
      />
      <Tab.Screen
        name="PassengerAlerts"
        component={PlaceholderScreen}
        options={{ title: "Alerts", tabBarIcon: ({ color }) => <Text style={{ color }}>A</Text> }}
      />
      <Tab.Screen
        name="ProfileScreen"
        component={PlaceholderScreen}
        options={{ title: "Profile", tabBarIcon: ({ color }) => <Text style={{ color }}>P</Text> }}
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
