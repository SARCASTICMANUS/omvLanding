import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import LoginPage from "../auth/screens/LoginPage";
import RegisterPage from "../auth/screens/RegisterPage";
import PasswordResetPage from "../auth/screens/PasswordResetPage";
import OtpVerificationPage from "../auth/screens/OtpVerificationPage";

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LoginPage" component={LoginPage} />
      <Stack.Screen name="RegisterPage" component={RegisterPage} />
      <Stack.Screen name="PasswordReset" component={PasswordResetPage} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationPage} />
    </Stack.Navigator>
  );
}
