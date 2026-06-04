import React from "react";
import { Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";

import COLORS from "../shared/constants/colors";
import DriverRouteList from "../routes/screens/DriverRouteList";
import DriverLiveTracking from "../tracking/screens/DriverLiveTracking";
import DriverTripReview from "../routes/screens/DriverTripReview";
import ProfileScreen from "../shared/screens/ProfileScreen";
import { LayoutDashboard, Map, User } from "lucide-react-native";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const PlaceholderScreen = ({ route }) => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <Text>{route.name}</Text>
  </View>
);

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
      <Tab.Screen name="DriverHomeScreen" component={PlaceholderScreen} options={{ title: "Console", tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} /> }} />
      <Tab.Screen name="DriverRouteList" component={DriverRouteList} options={{ title: "Routes", tabBarIcon: ({ color, size }) => <Map size={size} color={color} /> }} />
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
    </Stack.Navigator>
  );
}
