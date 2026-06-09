import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import COLORS from '../../shared/constants/colors';
import { User, LayoutDashboard } from 'lucide-react-native';

import PassengerDevList from './PassengerDevList';
import DriverDevList from './DriverDevList';

const Tab = createBottomTabNavigator();

export default function DeveloperNavigator() {
  return (
    <Tab.Navigator
        screenOptions={{
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textLight,
            headerShown: true
        }}
    >
        <Tab.Screen 
            name="PassengerList" 
            component={PassengerDevList} 
            options={{
                title: 'Passenger Screens',
                tabBarIcon: ({ color, size }) => <User size={size} color={color} />
            }} 
        />
        <Tab.Screen 
            name="DriverList" 
            component={DriverDevList} 
            options={{
                title: 'Driver Screens',
                tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />
            }} 
        />
    </Tab.Navigator>
  );
}
