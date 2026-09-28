import React, { useState, useEffect, useRef } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import COLORS from "../shared/constants/colors";
import { ROLE } from "../constants";
import DriverModeSelectScreen from "../driver/screens/DriverModeSelectScreen";
import DriverBikeHomeScreen from "../driver/bike-ride/DriverBikeHomeScreen";
import DriverRouteList from "../driver/screens/DriverRouteList";
import DriverFindPassengersScreen from "../driver/screens/DriverFindPassengersScreen";
import DriverLiveTracking from "../driver/screens/DriverLiveTracking";
import DriverTripReview from "../driver/screens/DriverTripReview";
import DriverTripHistoryScreen from "../driver/screens/DriverTripHistoryScreen";
import ProfileScreen from "../shared/screens/ProfileScreen";
import EditProfileScreen from "../shared/screens/EditProfileScreen";
import PrivacyPolicyScreen from "../shared/screens/PrivacyPolicyScreen";
import HelpSupportScreen from "../shared/screens/HelpSupportScreen";
import BikeFindPassengerScreen from "../driver/bike-ride/BikeFindPassengerScreen";
import VerificationPopup from "../shared/components/VerificationPopup";
import { fetchVerificationStatus } from "../store/slices/profileSlice";

// Profile Completion Screen
import DriverProfileCompletionScreen from "../auth/screens/DriverRegistration/DriverProfileCompletionScreen";

// Auto Flow Screens
import DriverAutoHomeScreen from "../driver/shared-auto/DriverAutoHomeScreen";
import AutoFindPassengerScreen from "../driver/shared-auto/AutoFindPassengerScreen";
import AutoRideToPickupScreen from "../driver/shared-auto/AutoRideToPickupScreen";
import AutoRideToDestinationScreen from "../driver/shared-auto/AutoRideToDestinationScreen";
import AutoTripCompleteScreen from "../driver/shared-auto/AutoTripCompleteScreen";
import { LayoutDashboard, History, User } from "lucide-react-native";

// Auto Flow Screens (for future)
import AutoAheadAlertScreen from "../driver/shared-auto/AutoAheadAlertScreen";
import AutoBoardedPopupScreen from "../driver/shared-auto/AutoBoardedPopupScreen";
import AutoLiveTrackingScreen from "../driver/shared-auto/AutoLiveTrackingScreen";

// Bike Flow Screens
import { BikeSearchingScreen } from "../passenger/bike-ride/BikeSearchingScreen";
import BikeOTPEntryScreen from "../driver/bike-ride/BikeOTPEntryScreen";
import VehicleSelectionScreen from "../driver/screens/VehicleSelectionScreen";
import BikeRideToPickupScreen from "../driver/bike-ride/BikeRideToPickupScreen";
import BikeRideToDestinationScreen from "../driver/bike-ride/BikeRideToDestinationScreen";
import BikeTripCompleteScreen from "../driver/bike-ride/BikeTripCompleteScreen";
import TripEndSummary from "../routes/screens/TripEndSummary";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function DriverHomeTab({ navigation }) {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  if (role === ROLE.AUTO_DRIVER) {
    return <DriverAutoHomeScreen navigation={navigation} />;
  }

  if (role === ROLE.BIKE_DRIVER) {
    return <DriverBikeHomeScreen navigation={navigation} />;
  }

  return <DriverModeSelectScreen navigation={navigation} />;
}

function DriverTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
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
      <Tab.Screen name="DriverModeSelect" component={DriverHomeTab} options={{ title: "Home", tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} /> }} />
      <Tab.Screen name="DriverRoutes" component={DriverTripHistoryScreen} initialParams={{ list: true }} options={{ title: "My Trips", tabBarIcon: ({ color, size }) => <History size={size} color={color} /> }} />
      <Tab.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function DriverNavigator() {
  const [showVerification, setShowVerification] = useState(false);
  const dismissedRef = useRef(false);
  const dispatch = useDispatch();
  const { verification } = useSelector((state) => state.profile);
  const navigation = useNavigation();

  const checkVerification = () => {
    if (dismissedRef.current) return;
    dispatch(fetchVerificationStatus())
      .unwrap()
      .then((res) => {
        const s = res?.status;
        if (dismissedRef.current && s !== "rejected") return;
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

  // Re-check on stack state changes (push/pop within stack)
  useEffect(() => {
    const unsub = navigation.addListener("state", () => {
      checkVerification();
    });
    return unsub;
  }, [navigation, dispatch]);

  // Reset dismissed flag when navigator loses focus (e.g. logout/switch role)
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
        <Stack.Screen name="DriverTabs" component={DriverTabs} />
        <Stack.Screen name="DriverRouteSearch" component={DriverRouteList} />
        <Stack.Screen name="DriverBikeHome" component={DriverBikeHomeScreen} />
        <Stack.Screen name="DriverTripReview" component={DriverTripReview} />
        <Stack.Screen name="DriverLiveTracking" component={DriverLiveTracking} />
        <Stack.Screen name="DriverTripHistoryScreen" component={DriverTripHistoryScreen} />
        <Stack.Screen name="VehicleSelectionScreen" component={VehicleSelectionScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="DriverProfileCompletion" component={DriverProfileCompletionScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="FindPassenger" component={BikeFindPassengerScreen} />
        <Stack.Screen name="DriverFindPassengers" component={DriverFindPassengersScreen} />
        <Stack.Screen name="AheadAlert" component={AutoAheadAlertScreen} />
        <Stack.Screen name="BoardedPopup" component={AutoBoardedPopupScreen} />
        <Stack.Screen
          name="AutoRideActive"
          component={AutoLiveTrackingScreen}
          initialParams={{ mode: "auto" }}
        />
        <Stack.Screen name="BikeSearching" component={BikeSearchingScreen} />
        <Stack.Screen name="BikeOTPEntry" component={BikeOTPEntryScreen} />
        <Stack.Screen name="BikeRideToPickup" component={BikeRideToPickupScreen} />
        <Stack.Screen name="BikeRideToDestination" component={BikeRideToDestinationScreen} />
        <Stack.Screen name="BikeTripComplete" component={BikeTripCompleteScreen} />
        <Stack.Screen name="TripEndSummary" component={TripEndSummary} />
        <Stack.Screen name="DriverAutoHome" component={DriverAutoHomeScreen} />
        <Stack.Screen name="AutoFindPassenger" component={AutoFindPassengerScreen} />
        <Stack.Screen name="AutoRideToPickup" component={AutoRideToPickupScreen} />
        <Stack.Screen name="AutoRideToDestination" component={AutoRideToDestinationScreen} />
        <Stack.Screen name="AutoTripComplete" component={AutoTripCompleteScreen} />
      </Stack.Navigator>
      <VerificationPopup
        visible={showVerification}
        onDismiss={handleDismiss}
        navigation={navigation}
        onNavigate={() =>
          navigation.navigate("DriverNavigator", {
            screen: "DriverProfileCompletion",
            params: verification?.status === "rejected" ? { mode: "manage" } : {},
          })
        }
      />
    </>
  );
}
