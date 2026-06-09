import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import COLORS from '../../shared/constants/colors';

// Passenger Screen Imports
import { BikeMapPostAcceptScreen } from '../../passenger/bike-ride/MapPostAcceptScreen';
import { BikeMapPreRideScreen } from '../../passenger/bike-ride/MapPreRideScreen';
import { RiderPopupScreen } from '../../passenger/bike-ride/RiderPopupScreen';
import { RideStatsScreen } from '../../passenger/bike-ride/RideStatsScreen';
import DestinationSearchScreen from '../../passenger/screens/DestinationSearchScreen';
import JourneyHistoryScreen from '../../passenger/screens/JourneyHistoryScreen';
import PassengerHomeScreen from '../../passenger/screens/PassengerHomeScreen';
import PassengerModeSelectScreen from '../../passenger/screens/PassengerModeSelectScreen';
import PassengerAlertsScreen from '../../handshake/screens/PassengerAlertsScreen';
import RaiseHandScreen from '../../handshake/screens/RaiseHandScreen';
import RouteListScreen from '../../shared/screens/RouteListScreen';
import ProfileScreen from '../../shared/screens/ProfileScreen';

const screens = [
  { name: 'Bike Map Post Accept', component: BikeMapPostAcceptScreen },
  { name: 'Bike Map Pre Ride', component: BikeMapPreRideScreen },
  { name: 'Rider Popup', component: RiderPopupScreen },
  { name: 'Ride Stats', component: RideStatsScreen },
  { name: 'Destination Search', component: DestinationSearchScreen },
  { name: 'Journey History', component: JourneyHistoryScreen },
  { name: 'Passenger Home', component: PassengerHomeScreen },
  { name: 'Passenger Mode Select', component: PassengerModeSelectScreen },
  { name: 'Passenger Alerts', component: PassengerAlertsScreen },
  { name: 'Raise Hand', component: RaiseHandScreen },
  { name: 'Route List', component: RouteListScreen },
  { name: 'Profile Screen', component: ProfileScreen },
];

export default function PassengerDevList() {
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
