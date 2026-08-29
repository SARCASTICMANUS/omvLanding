import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SPACING from "../../shared/constants/spacing";
import { getRideHistory } from "../services/passengerService";

function formatTrip(trip) {
  const pickup = trip.pickup_name || trip.route_name || trip.pickup || "--";
  const destination = trip.destination_name || trip.route_name || trip.destination || "--";
  const date = trip.date || trip.ended_at || trip.started_at || "";
  const formattedDate = date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "--";
  const fare = trip.fare || trip.total_fare || null;
  const vehicleType = trip.vehicle_type || trip.mode || "Auto";
  const distance = trip.distance_km || (trip.total_distance_m != null ? trip.total_distance_m / 1000 : null);
  const distanceText = distance != null ? (typeof distance === "number" ? `${distance.toFixed(1)} km` : distance) : "--";
  const duration = trip.duration_min || (trip.total_duration_s != null ? trip.total_duration_s / 60 : null);
  const durationText = duration != null ? (typeof duration === "number" ? `${duration.toFixed(1)} min` : duration) : "--";
  const routeName = trip.route_name || trip.route?.name || "Direct Ride";

  return {
    id: String(trip.id || trip.trip_id || Math.random()),
    pickup,
    destination,
    date: formattedDate,
    fare: fare ? `₹${fare}` : "--",
    vehicleType,
    status: trip.status || "Completed",
    routeName,
    distance: distanceText,
    duration: durationText,
  };
}

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
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getRideHistory();
        const items = Array.isArray(data) ? data : data?.results || [];
        setRoutes(items.map(formatTrip));
      } catch (error) {
        console.error("Failed to fetch ride history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <View style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerGradient}>
          <View style={styles.gradBase} />
          <View style={styles.gradRay1} />
          <View style={styles.gradRay2} />
        </View>
        <Text style={styles.title}>My Trips</Text>
        <Text style={styles.subtitle}>Your completed journeys</Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    position: "relative",
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  gradBase: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#009849",
  },
  gradRay1: {
    position: "absolute",
    top: -60, right: -40,
    width: "70%", height: "90%",
    backgroundColor: "#00B857",
    opacity: 0.25,
    borderRadius: 120,
    transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute",
    top: -80, right: -20,
    width: "50%", height: "70%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100,
    transform: [{ rotate: "35deg" }],
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    position: "relative",
    zIndex: 2,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
    position: "relative",
    zIndex: 2,
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
