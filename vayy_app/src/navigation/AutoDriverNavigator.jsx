import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import AutoAheadAlertScreen from "../auto/screens/AutoAheadAlertScreen";
import AutoBestMatchRouteScreen from "../auto/screens/AutoBestMatchRouteScreen";
import AutoBoardedPopupScreen from "../auto/screens/AutoBoardedPopupScreen";
import AutoFindPassengerScreen from "../auto/screens/AutoFindPassengerScreen";
import FromToScreen from "../shared/screens/FromToScreen";
import DriverLoginScreen from "../auth/screens/DriverLoginScreen";
import AutoLiveTrackingScreen from "../auto/screens/AutoLiveTrackingScreen";
import DriverTripHistoryScreen from "../driver/screens/DriverTripHistoryScreen";

const Stack = createStackNavigator();

export default function AutoDriverNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AutoLogin" component={DriverLoginScreen} />
      <Stack.Screen name="AutoDriverFromTo" component={FromToScreen} />
      <Stack.Screen name="AutoBestMatchRoute" component={AutoBestMatchRouteScreen} />
      <Stack.Screen name="FindPassenger" component={AutoFindPassengerScreen} />
      <Stack.Screen name="AheadAlert" component={AutoAheadAlertScreen} />
      <Stack.Screen name="BoardedPopup" component={AutoBoardedPopupScreen} />
      <Stack.Screen name="AutoRideActive" component={AutoLiveTrackingScreen} />
      <Stack.Screen name="AutoTripComplete" component={DriverTripHistoryScreen} />
    </Stack.Navigator>
  );
}
