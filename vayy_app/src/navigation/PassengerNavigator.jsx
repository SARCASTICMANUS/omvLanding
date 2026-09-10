import React, { useState, useEffect, useRef } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import COLORS from "../shared/constants/colors";
import IntroPage from "../passenger/screens/IntroPage";
import MyRoutesScreen from "../passenger/screens/MyRoutesScreen";
import PassengerRouteList from "../routes/screens/PassengerRouteList";
import PassengerLiveTracking from "../tracking/screens/PassengerLiveTracking";
import PassengerTripPlanner from "../passenger/screens/PassengerTripPlanner";
import ProfileScreen from "../shared/screens/ProfileScreen";
import EditProfileScreen from "../shared/screens/EditProfileScreen";
import PrivacyPolicyScreen from "../shared/screens/PrivacyPolicyScreen";
import HelpSupportScreen from "../shared/screens/HelpSupportScreen";
import PassengerAlertsScreen from "../handshake/screens/PassengerAlertsScreen";
import JourneyHistoryScreen from "../passenger/screens/JourneyHistoryScreen";
import DestinationSearchScreen from "../passenger/screens/DestinationSearchScreen";
import VerificationPopup from "../shared/components/VerificationPopup";
import { useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { fetchVerificationStatus } from "../store/slices/profileSlice";
import { DRIVER_ROLES } from "../constants";
import { MaterialIcons } from "@expo/vector-icons";

// Bike Flow Screens
import { BikeMapPreRideScreen } from "../passenger/bike-ride/MapPreRideScreen";
import { RiderPopupScreen } from "../passenger/bike-ride/RiderPopupScreen";
import { RideStatsScreen } from "../passenger/bike-ride/RideStatsScreen";
import { BikeSearchingScreen } from "../passenger/bike-ride/BikeSearchingScreen";
import { RideCompleteScreen } from "../passenger/bike-ride/RideCompleteScreen";

// Auto Flow Screens
import { AutoPreRideScreen } from "../passenger/shared-auto/AutoPreRideScreen";
import { AutoSearchingScreen } from "../passenger/shared-auto/AutoSearchingScreen";
import { AutoDiscoveryScreen } from "../passenger/shared-auto/AutoDiscoveryScreen";
import { AutoRideActiveScreen } from "../passenger/shared-auto/AutoRideActiveScreen";
import { AutoRideCompleteScreen } from "../passenger/shared-auto/AutoRideCompleteScreen";
import { SharedAutoMapScreen } from "../passenger/shared-auto/MapScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function PassengerTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="PassengerHome"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          height: 62 + insets.bottom,
          paddingBottom: 14 + insets.bottom,
          paddingTop: 4,
          position: "absolute",
        },
      }}
    >
      <Tab.Screen
        name="PassengerHome"
        component={IntroPage}
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="PassengerRoutes"
        component={MyRoutesScreen}
        options={{ title: "My Trips", tabBarIcon: ({ color, size }) => <MaterialIcons name="history" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="PassengerAlerts"
        component={PassengerAlertsScreen}
        options={{ title: "Alerts", tabBarIcon: ({ color, size }) => <MaterialIcons name="notifications" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function PassengerNavigator() {
  const [showVerification, setShowVerification] = useState(false);
  const dismissedRef = useRef(false);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const checkVerification = () => {
    if (dismissedRef.current) return;
    dispatch(fetchVerificationStatus())
      .unwrap()
      .then((res) => {
        const s = res?.status;
        if (s && s !== "verified" && !dismissedRef.current) {
          setShowVerification(true);
        } else {
          setShowVerification(false);
        }
      })
      .catch(() => {
        if (!dismissedRef.current) {
          setShowVerification(true);
        }
      });
  };

  useEffect(() => { checkVerification(); }, [dispatch]);

  useEffect(() => {
    const unsub = navigation.addListener("state", () => {
      checkVerification();
    });
    return unsub;
  }, [navigation, dispatch]);

  // Reset dismissed when navigator loses focus (logout/role switch)
  useEffect(() => {
    const unsub = navigation.addListener("blur", () => {
      dismissedRef.current = false;
    });
    return unsub;
  }, [navigation]);

  const handleDismiss = () => {
    dismissedRef.current = true;
    setShowVerification(false);
  };

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="PassengerTabs" component={PassengerTabs} />
        <Stack.Screen name="PassengerRouteList" component={PassengerRouteList} />
        <Stack.Screen name="PassengerLiveTracking" component={PassengerLiveTracking} />
        <Stack.Screen name="JourneyHistoryScreen" component={JourneyHistoryScreen} />
        <Stack.Screen name="DestinationSearchScreen" component={DestinationSearchScreen} />
        <Stack.Screen name="PassengerTripPlanner" component={PassengerTripPlanner} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />

        {/* Bike Flow */}
        <Stack.Screen name="BikeMapPreRide" component={BikeMapPreRideScreen} />
        <Stack.Screen name="RiderPopup" component={RiderPopupScreen} />
        <Stack.Screen name="RideStats" component={RideStatsScreen} />
        <Stack.Screen name="BikeSearching" component={BikeSearchingScreen} />
        <Stack.Screen name="RideComplete" component={RideCompleteScreen} />

        {/* Auto Flow */}
        <Stack.Screen name="AutoPreRide" component={AutoPreRideScreen} />
        <Stack.Screen name="AutoSearching" component={AutoSearchingScreen} />
        <Stack.Screen name="AutoDiscovery" component={AutoDiscoveryScreen} />
        <Stack.Screen name="AutoRideActive" component={AutoRideActiveScreen} />
        <Stack.Screen name="AutoRideComplete" component={AutoRideCompleteScreen} />
        <Stack.Screen name="SharedAutoMap" component={SharedAutoMapScreen} />
      </Stack.Navigator>
      <VerificationPopup
        visible={showVerification}
        onDismiss={handleDismiss}
        navigation={navigation}
      />
    </>
  );
}
