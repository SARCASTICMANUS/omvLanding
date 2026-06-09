import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import COLORS from '../../shared/constants/colors';

// Import Route and Shared screens
import RouteCreationScreen from '../../routes/screens/RouteCreationScreen';
import RouteDetailsScreen from '../../routes/screens/RouteDetailsScreen';
import RouteLibraryScreen from '../../routes/screens/RouteLibraryScreen';
import RouteResultsScreen from '../../routes/screens/RouteResultsScreen';
import RouteSelectionScreen from '../../routes/screens/RouteSelectionScreen';
import LoadingScreen from '../../shared/components/common/LoadingScreen';

const screens = [
  { name: 'Route Creation', component: RouteCreationScreen },
  { name: 'Route Details', component: RouteDetailsScreen },
  { name: 'Route Library', component: RouteLibraryScreen },
  { name: 'Route Results', component: RouteResultsScreen },
  { name: 'Route Selection', component: RouteSelectionScreen },
  { name: 'Loading Screen', component: LoadingScreen },
];

export default function OtherDevList() {
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
