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

const Stack = createStackNavigator();

const passengerRoles = ["passenger", "student"];
const driverRoles = ["driver"];

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    dispatch(restoreAuthFromStorage());
    AsyncStorage.getItem("@vayy_onboarding_done").then((val) => {
      setOnboardingDone(val === "true");
    });
  }, [dispatch]);

  if (onboardingDone === null) return null;

  const role = user?.role;
  const isDriver = driverRoles.includes(role);

  let initialRoute;
  if (!onboardingDone) {
    initialRoute = "SplashCarousel";
  } else if (!isAuthenticated) {
    initialRoute = "AuthNavigator";
  } else if (isDriver) {
    initialRoute = "DriverNavigator";
  } else {
    initialRoute = "PassengerNavigator";
  }

  const tag = onboardingDone ? "onboarded" : "new";
  const authTag = isAuthenticated ? (isDriver ? "driver" : "passenger") : "guest";

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={`${tag}_${authTag}`}
        screenOptions={{ headerShown: false }}
        initialRouteName={initialRoute}
      >
        <Stack.Screen name="SplashCarousel" component={SplashCarouselScreen} />
        <Stack.Screen name="AuthNavigator" component={AuthNavigator} />
        <Stack.Screen name="DriverNavigator" component={DriverNavigator} />
        <Stack.Screen name="PassengerNavigator" component={PassengerNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
