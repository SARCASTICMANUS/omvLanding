import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SPACING from "../../shared/constants/spacing";

const MOCK_COMPLETED_ROUTES = [
  {
    id: "1",
    pickup: "Gomti Nagar, Lucknow",
    destination: "Hazratganj, Lucknow",
    date: "22 Jun 2026",
    fare: "₹78",
    vehicleType: "Auto",
    status: "Completed",
    routeName: "Route 12",
    distance: "4.5 km",
    duration: "15 min",
  },
  {
    id: "2",
    pickup: "Indira Nagar, Lucknow",
    destination: "Charbagh, Lucknow",
    date: "20 Jun 2026",
    fare: "₹65",
    vehicleType: "Auto",
    status: "Completed",
    routeName: "Route 7",
    distance: "6.2 km",
    duration: "22 min",
  },
  {
    id: "3",
    pickup: "Gomti Nagar, Lucknow",
    destination: "Aliganj, Lucknow",
    date: "18 Jun 2026",
    fare: "₹25",
    vehicleType: "Bike",
    status: "Completed",
    routeName: "Direct Ride",
    distance: "3.1 km",
    duration: "8 min",
  },
  {
    id: "4",
    pickup: "Hazratganj, Lucknow",
    destination: "Gomti Nagar, Lucknow",
    date: "15 Jun 2026",
    fare: "₹85",
    vehicleType: "Auto",
    status: "Completed",
    routeName: "Route 12",
    distance: "4.5 km",
    duration: "18 min",
  },
  {
    id: "5",
    pickup: "Charbagh, Lucknow",
    destination: "Gomti Nagar Crossing",
    date: "12 Jun 2026",
    fare: "₹35",
    vehicleType: "Bike",
    status: "Completed",
    routeName: "Direct Ride",
    distance: "4.0 km",
    duration: "10 min",
  },
  {
    id: "6",
    pickup: "Aliganj, Lucknow",
    destination: "Indira Nagar, Lucknow",
    date: "10 Jun 2026",
    fare: "₹55",
    vehicleType: "Auto",
    status: "Completed",
    routeName: "Route 5",
    distance: "5.0 km",
    duration: "20 min",
  },
];

function RouteCard({ item }) {
  const isAuto = item.vehicleType === "Auto";
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardHeader}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>{item.routeName}</Text>
          </View>
          <View style={[styles.vehicleBadge, isAuto ? styles.autoBadge : styles.bikeBadge]}>
            <Text style={[styles.vehicleBadgeText, isAuto ? styles.autoBadgeText : styles.bikeBadgeText]}>
              {item.vehicleType}
            </Text>
          </View>
        </View>
        <View style={styles.completedChip}>
          <View style={styles.completedDot} />
          <Text style={styles.completedText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.routeDot} />
        <View style={styles.routeLine} />
        <View style={[styles.routeDot, styles.routeDotDest]} />
      </View>

      <View style={styles.locRow}>
        <Text style={styles.locText} numberOfLines={1}>{item.pickup}</Text>
        <Text style={styles.arrowText}>→</Text>
        <Text style={[styles.locText, styles.locDest]} numberOfLines={1}>{item.destination}</Text>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{item.date}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Distance</Text>
          <Text style={styles.metaValue}>{item.distance}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Fare</Text>
          <Text style={styles.fareValue}>{item.fare}</Text>
        </View>
      </View>
    </View>
  );
}

export default function MyRoutesScreen({ navigation }) {
  const [routes] = useState(MOCK_COMPLETED_ROUTES);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>My Routes</Text>
        <Text style={styles.subtitle}>Your completed journeys</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={routes}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No completed routes yet</Text>
            <Text style={styles.emptyText}>
              Your completed rides will appear here once you take a trip.
            </Text>
          </View>
        }
        renderItem={({ item }) => <RouteCard item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.base,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + SPACING.base : SPACING.base,
    paddingBottom: SPACING.base,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  listContent: {
    padding: SPACING.base,
    gap: SPACING.base,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    gap: SPACING.md,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  routeBadge: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  vehicleBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  autoBadge: {
    backgroundColor: "#FFF3E0",
  },
  bikeBadge: {
    backgroundColor: "#E8F5E9",
  },
  vehicleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  autoBadgeText: {
    color: "#E65100",
  },
  bikeBadgeText: {
    color: COLORS.primary,
  },
  completedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  completedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  completedText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  routeDotDest: {
    backgroundColor: COLORS.text,
  },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.borderMedium,
    marginHorizontal: 6,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  locText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  locDest: {
    fontWeight: "700",
    color: COLORS.text,
  },
  arrowText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: "900",
  },
  cardBottom: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  metaRow: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  metaDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  fareValue: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.primary,
  },
  emptyState: {
    alignItems: "center",
    gap: SPACING.md,
    paddingTop: SPACING.xxxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    paddingHorizontal: SPACING.xl,
  },
});
