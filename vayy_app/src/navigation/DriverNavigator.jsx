import React from "react";
import { Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";

import COLORS from "../constants/colors";
import DriverRouteList from "../screens/driver/DriverRouteList";
import DriverLiveTracking from "../screens/driver/DriverLiveTracking";
import DriverTripReview from "../screens/driver/DriverTripReview";

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
      <Tab.Screen name="DriverHomeScreen" component={PlaceholderScreen} options={{ title: "Console" }} />
      <Tab.Screen name="DriverRouteList" component={DriverRouteList} options={{ title: "Routes" }} />
      <Tab.Screen name="ProfileScreen" component={PlaceholderScreen} options={{ title: "Profile" }} />
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
