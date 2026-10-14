import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useDispatch, useSelector } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { restoreAuthFromStorage } from "../auth/authSlice";
import AuthNavigator from "./AuthNavigator";
import DriverNavigator from "./DriverNavigator";
import PassengerNavigator from "./PassengerNavigator";
import AdminScreen from "../admin/screens/AdminScreen";
import SplashCarouselScreen, { onboardingSession } from "../shared/screens/SplashCarouselScreen";
import { DRIVER_ROLES, STORAGE_KEYS } from "../constants";
import NotificationRoot from "../shared/components/common/NotificationRoot";

const Stack = createStackNavigator();

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const [booting, setBooting] = useState(!onboardingSession.decided);

  useEffect(() => {
    let cancelled = false;

    // Onboarding carousel is first-launch only. STORAGE_KEYS.onboardingDone is
    // written by SplashCarouselScreen, and the session flag it also updates
    // survives the NavigationContainer remounts that login/logout trigger. If
    // this JS session already resolved onboarding (or the carousel completed),
    // skip straight past — re-reading storage here is what made the splash
    // reappear on every auth state change.
    (async () => {
      if (onboardingSession.decided) {
        if (cancelled) return;
        setBooting(false);
        return;
      }

      let onboardingDone = null;
      try {
        onboardingDone = await AsyncStorage.getItem(STORAGE_KEYS.onboardingDone);
      } catch {
        onboardingDone = null;
      }

      await dispatch(restoreAuthFromStorage());

      if (cancelled) return;
      onboardingSession.decide(onboardingDone !== "true");
      setBooting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const role = user?.role;
  const isDriver = DRIVER_ROLES.includes(role);
  const isAdmin = role === "admin";

  const appRoute = isAuthenticated
    ? isAdmin
      ? "AdminScreen"
      : isDriver
        ? "DriverNavigator"
        : "PassengerNavigator"
    : "AuthNavigator";

  // Never route an already-signed-in user through onboarding, and never
  // re-show the carousel after it has been completed in this session.
  const showOnboarding = onboardingSession.pending && !isAuthenticated;

  const initialRoute = showOnboarding ? "SplashCarousel" : appRoute;

  const authTag = isAuthenticated ? (isAdmin ? "admin" : isDriver ? "driver" : "passenger") : "guest";
  const navKey = `app_${authTag}`;

  // Hold the navigator until both AsyncStorage reads settle, so initialRouteName
  // is decided once and the splash never flashes for returning users.
  if (booting) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  return (
    <NavigationContainer key={navKey}>
      <View style={{ flex: 1 }}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen
            name="SplashCarousel"
            component={SplashCarouselScreen}
            initialParams={{ next: appRoute }}
          />
          <Stack.Screen name="AuthNavigator" component={AuthNavigator} />
          <Stack.Screen name="DriverNavigator" component={DriverNavigator} />
          <Stack.Screen name="PassengerNavigator" component={PassengerNavigator} />
          <Stack.Screen name="AdminScreen" component={AdminScreen} />
        </Stack.Navigator>
        {/* Must live inside NavigationContainer: the notification listener
            uses useNavigation() to route taps, and it was never mounted, so no
            WS event ever reached addNotification in the slice. */}
        <NotificationRoot />
      </View>
    </NavigationContainer>
  );
}