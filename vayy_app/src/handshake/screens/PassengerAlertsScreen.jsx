import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";

import VayyCard from "../../shared/components/common/VayyCard";
import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import RADIUS from "../../shared/constants/radius";

const DUMMY_ALERTS = [
  {
    id: "1",
    title: "Bus Approaching",
    message: "Bus #VAYY-101 is 500m away from your stop (Sector 12).",
    timestamp: "2 mins ago",
    type: "info",
  },
  {
    id: "2",
    title: "Bus Arrived",
    message: "Bus #VAYY-101 has arrived at Sector 12 stop. Please board promptly.",
    timestamp: "1 min ago",
    type: "info",
  },
  {
    id: "3",
    title: "Boarding Confirmed",
    message: "Your boarding request for Trip #823 has been accepted by the driver.",
    timestamp: "1 hour ago",
    type: "success",
  },
  {
    id: "4",
    title: "Trip Delay",
    message: "Bus #VAYY-205 is delayed by 10 minutes due to heavy traffic.",
    timestamp: "3 hours ago",
    type: "warning",
  },
  {
    id: "5",
    title: "Boarding Rejected",
    message: "Boarding request for Trip #999 was rejected. The bus has reached capacity.",
    timestamp: "4 hours ago",
    type: "error",
  },
  {
    id: "6",
    title: "Route Diversion",
    message: "Trip #442 has a route diversion near M.G. Road. Please check the map.",
    timestamp: "5 hours ago",
    type: "warning",
  },
];

export default function PassengerAlertsScreen() {
  const getAlertTitleColor = (type) => {
    switch (type) {
      case "success": return COLORS.primary;
      case "warning": return COLORS.warning;
      case "error": return COLORS.error;
      default: return COLORS.text;
    }
  };

  const renderAlertItem = ({ item }) => (
    <VayyCard style={styles.alertCard}>
      <View style={styles.alertHeader}>
        <Text style={[styles.alertTitle, { color: getAlertTitleColor(item.type) }]}>
          {item.title}
        </Text>
        <Text style={styles.timestamp}>{item.timestamp}</Text>
      </View>
      <Text style={styles.alertMessage}>{item.message}</Text>
    </VayyCard>
  );

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <FlatList
          data={DUMMY_ALERTS}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No new alerts</Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: SPACING.base,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: SPACING.lg,
    marginTop: Platform.OS === "android" ? StatusBar.currentHeight + SPACING.base : SPACING.md,
  },
  listContent: {
    gap: SPACING.base,
  },
  alertCard: {
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  alertMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  emptyText: {
    textAlign: "center",
    marginTop: SPACING.xxxl,
    color: COLORS.textMuted,
    fontSize: 15,
  },
});
