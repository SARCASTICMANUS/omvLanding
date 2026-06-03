import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useDispatch, useSelector } from "react-redux";

import { restoreAuthFromStorage } from "../features/auth/authSlice";
import AuthNavigator from "./AuthNavigator";
import DriverNavigator from "./DriverNavigator";
import PassengerNavigator from "./PassengerNavigator";

const Stack = createStackNavigator();

const passengerRoles = ["passenger", "student"];
const driverRoles = ["driver"];

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(restoreAuthFromStorage());
  }, [dispatch]);

  const role = user?.role;
  const isDriver = driverRoles.includes(role);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="AuthNavigator" component={AuthNavigator} />
        ) : isDriver ? (
          <Stack.Screen name="DriverNavigator" component={DriverNavigator} />
        ) : (
          <Stack.Screen name="PassengerNavigator" component={PassengerNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
