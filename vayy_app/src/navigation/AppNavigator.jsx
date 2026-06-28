import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { restoreAuthFromStorage } from "../auth/authSlice";
import AuthNavigator from "./AuthNavigator";
import DriverNavigator from "./DriverNavigator";
import PassengerNavigator from "./PassengerNavigator";
import SplashCarouselScreen from "../passenger/splash/SplashCarouselScreen";
import { DRIVER_ROLES, STORAGE_KEYS } from "../constants";

const Stack = createStackNavigator();

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    dispatch(restoreAuthFromStorage());
    AsyncStorage.getItem(STORAGE_KEYS.onboardingDone).then((val) => {
      setOnboardingDone(val === "true");
    });
  }, [dispatch]);

  if (onboardingDone === null) return null;

  const role = user?.role;
  const isDriver = DRIVER_ROLES.includes(role);

  let initialRoute;
  if (isAuthenticated) {
    initialRoute = isDriver ? "DriverNavigator" : "PassengerNavigator";
  } else if (!onboardingDone) {
    initialRoute = "SplashCarousel";
  } else {
    initialRoute = "AuthNavigator";
  }

  const tag = onboardingDone ? "onboarded" : "new";
  const authTag = isAuthenticated ? (isDriver ? "driver" : "passenger") : "guest";

  const navKey = `${tag}_${authTag}`;

  return (
    <NavigationContainer key={navKey}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="SplashCarousel" component={SplashCarouselScreen} />
        <Stack.Screen name="AuthNavigator" component={AuthNavigator} />
        <Stack.Screen name="DriverNavigator" component={DriverNavigator} />
        <Stack.Screen name="PassengerNavigator" component={PassengerNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
