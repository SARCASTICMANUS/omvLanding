import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useDispatch, useSelector } from "react-redux";

import { restoreAuthFromStorage } from "../auth/authSlice";
import AuthNavigator from "./AuthNavigator";
import DriverNavigator from "./DriverNavigator";
import PassengerNavigator from "./PassengerNavigator";
import AdminScreen from "../admin/screens/AdminScreen";
import SplashCarouselScreen from "../passenger/splash/SplashCarouselScreen";
import { DRIVER_ROLES } from "../constants";

const Stack = createStackNavigator();

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(restoreAuthFromStorage());
  }, [dispatch]);

  const role = user?.role;
  const isDriver = DRIVER_ROLES.includes(role);
  const isAdmin = role === "admin";

  let initialRoute;
  if (isAuthenticated) {
    if (isAdmin) {
      initialRoute = "AdminScreen";
    } else {
      initialRoute = isDriver ? "DriverNavigator" : "PassengerNavigator";
    }
  } else {
    initialRoute = "AuthNavigator";
  }

  const authTag = isAuthenticated ? (isAdmin ? "admin" : isDriver ? "driver" : "passenger") : "guest";
  const navKey = `app_${authTag}`;

  return (
    <NavigationContainer key={navKey}>
      <View style={{ flex: 1 }}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="SplashCarousel" component={SplashCarouselScreen} />
          <Stack.Screen name="AuthNavigator" component={AuthNavigator} />
          <Stack.Screen name="DriverNavigator" component={DriverNavigator} />
          <Stack.Screen name="PassengerNavigator" component={PassengerNavigator} />
          <Stack.Screen name="AdminScreen" component={AdminScreen} />
        </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
}