import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import COLORS from '../../shared/constants/colors';

// Driver Screen Imports
import { DriverLoginScreen } from '../../auth/screens/DriverLoginScreen';
import AutoAheadAlertScreen from '../../auto/screens/AutoAheadAlertScreen';
import { BestMatchRouteScreen as AutoBestMatchRouteScreen } from '../../auto/screens/AutoBestMatchRouteScreen';
import AutoBoardedPopupScreen from '../../auto/screens/AutoBoardedPopupScreen';
import { FindPassengerScreen as AutoFindPassengerScreen } from '../../auto/screens/AutoFindPassengerScreen';
import AutoLiveTrackingScreen from '../../auto/screens/AutoLiveTrackingScreen';
import DriverTrackingScreen from '../../auto/screens/DriverTrackingScreen';
import BikeBookingScreen from '../../bike/screens/BikeBookingScreen';
import BikeOTPHandshakeScreen from '../../bike/screens/BikeOTPHandshakeScreen';
import BikeRequestScreen from '../../bike/screens/BikeRequestScreen';
import BikeSearchingScreen from '../../bike/screens/BikeSearchingScreen';
import BikeTrackingScreen from '../../bike/screens/BikeTrackingScreen';
import DriverHomeScreen from '../../driver/screens/DriverHomeScreen';
import DriverTripHistoryScreen from '../../driver/screens/DriverTripHistoryScreen';
import VehicleSelectionScreen from '../../driver/screens/VehicleSelectionScreen';
import { RoleSelectScreen } from '../../screens/RoleSelectScreen';

const screens = [
  { name: 'Driver Login', component: DriverLoginScreen },
  { name: 'Auto Ahead Alert', component: AutoAheadAlertScreen },
  { name: 'Auto Best Match', component: AutoBestMatchRouteScreen },
  { name: 'Auto Boarded Popup', component: AutoBoardedPopupScreen },
  { name: 'Auto Find Passenger', component: AutoFindPassengerScreen },
  { name: 'Auto Live Tracking', component: AutoLiveTrackingScreen },
  { name: 'Driver Tracking', component: DriverTrackingScreen },
  { name: 'Bike Booking', component: BikeBookingScreen },
  { name: 'Bike OTP', component: BikeOTPHandshakeScreen },
  { name: 'Bike Request', component: BikeRequestScreen },
  { name: 'Bike Searching', component: BikeSearchingScreen },
  { name: 'Bike Tracking', component: BikeTrackingScreen },
  { name: 'Driver Home', component: DriverHomeScreen },
  { name: 'Driver Trip History', component: DriverTripHistoryScreen },
  { name: 'Vehicle Selection', component: VehicleSelectionScreen },
  { name: 'Role Select', component: RoleSelectScreen },
];

export default function DriverDevList() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container}>
      {screens.map((screen, index) => (
        <TouchableOpacity
          key={index}
          style={styles.button}
          onPress={() => navigation.navigate(screen.name)}
        >
          <Text style={styles.buttonText}>{screen.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: COLORS.white },
  button: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, marginBottom: 10 },
  buttonText: { color: COLORS.white, textAlign: 'center', fontWeight: 'bold' },
});
