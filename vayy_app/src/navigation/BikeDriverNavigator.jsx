import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import { BestMatchRouteScreen } from "../driver/shared-auto/AutoBestMatchRouteScreen";
import BikeBookingScreen from "../driver/bike-ride/BikeBookingScreen";
import BikeSearchingScreen from "../driver/bike-ride/BikeSearchingScreen";
import FromToScreen from "../shared/screens/FromToScreen";
import DriverLoginScreen from "../driver/screens/DriverLoginScreen";
import BikeOTPHandshakeScreen from "../driver/bike-ride/BikeOTPHandshakeScreen";
import BikeTrackingScreen from "../driver/bike-ride/BikeTrackingScreen";
import AutoLiveTrackingScreen from "../driver/shared-auto/AutoLiveTrackingScreen";
import DriverTripHistoryScreen from "../driver/screens/DriverTripHistoryScreen";

const Stack = createStackNavigator();

export default function BikeDriverNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BikeDriverLogin" component={DriverLoginScreen} />
      <Stack.Screen name="BikeDriverFromTo">
        {(props) => <FromToScreen {...props} mode="bike" />}
      </Stack.Screen>
      <Stack.Screen name="BikeBestMatchRoute">
        {(props) => <BestMatchRouteScreen {...props} mode="bike" />}
      </Stack.Screen>
      <Stack.Screen name="FindRideBuddy" component={BikeSearchingScreen} />
      <Stack.Screen name="BuddyRequestPopup" component={BikeBookingScreen} />
      <Stack.Screen name="OTPHandshake" component={BikeOTPHandshakeScreen} />
      <Stack.Screen name="BikeTracking" component={BikeTrackingScreen} />
      <Stack.Screen name="BikeRideActive">
        {(props) => <AutoLiveTrackingScreen {...props} mode="bike" />}
      </Stack.Screen>
      <Stack.Screen name="BikeTripComplete">
        {(props) => <DriverTripHistoryScreen {...props} mode="bike" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
