import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import LoginPage from "../screens/auth/LoginPage";
import RegisterPage from "../screens/auth/RegisterPage";

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LoginPage" component={LoginPage} />
      <Stack.Screen name="RegisterPage" component={RegisterPage} />
    </Stack.Navigator>
  );
}
