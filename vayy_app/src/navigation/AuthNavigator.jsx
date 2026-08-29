import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import LoginPage from "../auth/screens/LoginPage";
import RegisterPage from "../auth/screens/RegisterPage";
import PasswordResetPage from "../auth/screens/PasswordResetPage";
import OtpVerificationPage from "../auth/screens/OtpVerificationPage";
import RoleSelectionScreen from "../auth/screens/RoleSelectionScreen";
import PassengerRegistrationScreen from "../auth/screens/PassengerRegistration/PassengerRegistrationScreen";
import DriverRegistrationScreen from "../auth/screens/DriverRegistration/DriverRegistrationScreen";
import SplashPreviewScreen from "../shared/screens/SplashPreviewScreen";

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LoginPage" component={LoginPage} />
      <Stack.Screen name="SplashPreview" component={SplashPreviewScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="PassengerRegistration" component={PassengerRegistrationScreen} />
      <Stack.Screen name="DriverRegistration" component={DriverRegistrationScreen} />
      {/* Legacy screens (kept for backward compatibility) */}
      <Stack.Screen name="RegisterPage" component={RegisterPage} />
      <Stack.Screen name="PasswordReset" component={PasswordResetPage} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationPage} />
    </Stack.Navigator>
  );
}
