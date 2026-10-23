import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SPACING from "../../shared/constants/spacing";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import { getRideHistory, getTripFare } from "../services/passengerService";

function formatTrip(trip) {
  const pickup = trip.pickup_name || trip.route_name || trip.pickup || "--";
  const destination = trip.destination_name || trip.route_name || trip.destination || "--";
  const date = trip.date || trip.ended_at || trip.started_at || "";
  const formattedDate = date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "--";
  const fare = trip.fare ?? trip.total_fare ?? null;
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
    fare: fare != null ? `₹${fare}` : "--",
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
            <Text style={styles.routeBadgeText} numberOfLines={1}>{item.routeName}</Text>
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

export default function MyRoutesScreen() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getRideHistory({ status: "completed" });
        const items = (Array.isArray(data) ? data : data?.results || [])
          .filter((trip) => trip?.status === "completed" && Number(trip.fare ?? trip.total_fare) > 0);
        const detailedItems = await Promise.all(items.map(async (trip) => {
          if (trip.pickup_name && trip.pickup_name !== "--" && trip.destination_name && trip.destination_name !== "--" && trip.fare != null) return trip;
          try {
            const details = await getTripFare(trip.id);
            return {
              ...trip,
              pickup_name: trip.pickup_name && trip.pickup_name !== "--" ? trip.pickup_name : details.pickup_stop_name,
              destination_name: trip.destination_name && trip.destination_name !== "--" ? trip.destination_name : details.drop_stop_name,
              fare: trip.fare ?? details.total_fare,
              distance_km: details.segment_distance_m > 0
                ? details.segment_distance_m / 1000
                : details.distance_km || trip.distance_km,
            };
          } catch {
            return trip;
          }
        }));
        setRoutes(detailedItems.map(formatTrip));
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
      {/* Tab root — no back button. ScreenHeader renders a transparent spacer
          instead, so the title stays optically centred. */}
      <ScreenHeader
        title="My Trips"
        subtitle="Your completed journeys"
      />

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
    gap: SPACING.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  routeBadge: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
    flexShrink: 1,
  },
  vehicleBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexShrink: 0,
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
    flexShrink: 0,
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
