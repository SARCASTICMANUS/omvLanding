import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import AutoAheadAlertScreen from "../driver/shared-auto/AutoAheadAlertScreen";
import AutoBestMatchRouteScreen from "../driver/shared-auto/AutoBestMatchRouteScreen";
import AutoBoardedPopupScreen from "../driver/shared-auto/AutoBoardedPopupScreen";
import AutoFindPassengerScreen from "../driver/shared-auto/AutoFindPassengerScreen";
import FromToScreen from "../shared/screens/FromToScreen";
import DriverLoginScreen from "../driver/screens/DriverLoginScreen";
import AutoLiveTrackingScreen from "../driver/shared-auto/AutoLiveTrackingScreen";
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
