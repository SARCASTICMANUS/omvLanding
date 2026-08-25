import React, { useEffect } from "react";
import { FlatList, View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";
import { fetchRideHistory } from "../../store/slices/rideSlice";

const BAR_PATTERN = [8, 3, 12, 5, 6, 10, 4, 14, 7, 3, 9, 6, 11, 4, 5, 8, 13, 3, 7, 10, 6, 4, 12, 5, 9, 8, 3, 11, 6, 7, 14, 4, 10, 5, 8, 12, 3, 9, 6, 11, 7, 4, 13, 5, 8, 6, 10, 3, 12, 7];

function TripHistoryCard({ item, accent }) {
  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTop}>
        <View style={styles.historyVehicleWrap}>
          <Ionicons name={item.vehicle === "Bike" ? "bicycle" : "car"} size={14} color={accent} />
          <Text style={[styles.historyVehicleText, { color: accent }]}>{item.vehicle}</Text>
        </View>
        <Text style={styles.historyDate}>{item.date}</Text>
      </View>

      <View style={styles.historyRouteRow}>
        <View style={styles.historyDots}>
          <View style={[styles.historyDot, { backgroundColor: accent }]} />
          <View style={[styles.historyLine, { backgroundColor: COLORS.borderMedium }]} />
          <View style={styles.historyDotDest} />
        </View>
        <View style={styles.historyLocCol}>
          <Text style={styles.historyLocText} numberOfLines={1}>{item.pickup}</Text>
          <Text style={styles.historyLocDest} numberOfLines={1}>{item.destination}</Text>
        </View>
      </View>

      <View style={[styles.historyMeta, { borderColor: COLORS.border }]}>
        <View style={styles.historyMetaItem}>
          <Text style={styles.historyMetaLabel}>Distance</Text>
          <Text style={styles.historyMetaValue}>{item.distance}</Text>
        </View>
        <View style={styles.historyMetaDiv} />
        <View style={styles.historyMetaItem}>
          <Text style={styles.historyMetaLabel}>Duration</Text>
          <Text style={styles.historyMetaValue}>{item.duration}</Text>
        </View>
        <View style={styles.historyMetaDiv} />
        <View style={styles.historyMetaItem}>
          <Text style={styles.historyMetaLabel}>Earnings</Text>
          <Text style={[styles.historyEarnings, { color: accent }]}>{item.earnings}</Text>
        </View>
      </View>
    </View>
  );
}

function mapHistoryItem(raw, accent) {
  const vehicle = raw?.vehicle_type || raw?.vehicle || (accent === "#BA7517" ? "Auto" : "Bike");
  return {
    id: String(raw?.id ?? raw?.trip_id ?? raw?.dispatch_id ?? "--"),
    pickup: raw?.pickup_name || raw?.route_name || raw?.pickup || "--",
    destination: raw?.destination_name || raw?.route_name || raw?.destination || "--",
    date: raw?.date || raw?.ended_at || raw?.started_at || "--",
    fare: raw?.fare != null ? `₹${raw.fare}` : raw?.total_fare ? `₹${raw.total_fare}` : "--",
    distance: raw?.distance_km != null
      ? `${raw.distance_km} km`
      : raw?.total_distance_m != null
        ? `${(raw.total_distance_m / 1000).toFixed(1)} km`
        : raw?.distance !== undefined
          ? (typeof raw.distance === "number" ? `${raw.distance.toFixed(1)} km` : raw.distance)
          : "--",
    duration: raw?.duration_min != null
      ? `${raw.duration_min} min`
      : raw?.total_duration_s != null
        ? `${(raw.total_duration_s / 60).toFixed(1)} min`
        : raw?.duration !== undefined
          ? `${raw.duration} min`
          : "--",
    vehicle,
    earnings: raw?.earnings != null ? `₹${raw.earnings}` : raw?.total_fare ? `₹${raw.total_fare}` : raw?.fare ? `₹${raw.fare}` : "--",
  };
}

export default function DriverTripHistoryScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { mode = "bike", list } = route?.params || {};
  const accent = mode === "auto" ? "#BA7517" : "#009849";
  const insets = useSafeAreaInsets();
  const { history, historyLoading } = useSelector((state) => state.ride);
  const lastTrip = history?.[0];

  useEffect(() => {
    dispatch(fetchRideHistory({ status: "completed", page: 1 }));
  }, [dispatch]);

  if (historyLoading && history.length === 0) {
    return (
      <View style={styles.root}>
        <View style={[styles.container, { justifyContent: "center" }]}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </View>
    );
  }

  if (list) {
    const tripItems = history.map((raw) => mapHistoryItem(raw, accent));
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#009849" />
        <View style={[styles.listHeader, { paddingTop: insets.top + 6, overflow: "hidden" }]}>
          <View style={styles.headerGradient}>
            <View style={styles.gradBase} />
            <View style={styles.gradRay1} />
            <View style={styles.gradRay2} />
          </View>
          <View style={styles.headerRow}>
            <View style={styles.headerMid}>
              <Text style={styles.headerTitle}>Ride History</Text>
              <Text style={styles.headerSub}>Your completed trips</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={tripItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <TripHistoryCard item={item} accent={accent} />}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#009849" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark-circle" size={64} color={accent} />
        </View>
        <Text style={styles.title}>Trip Complete</Text>
        <Text style={styles.subtitle}>{lastTrip?.route_name || "You've reached your destination safely"}</Text>

        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{lastTrip?.fare ? `₹${lastTrip.fare}` : lastTrip?.earnings ? `₹${lastTrip.earnings}` : "--"}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{lastTrip?.distance ? (typeof lastTrip.distance === "number" ? `${lastTrip.distance.toFixed(1)} km` : lastTrip.distance) : lastTrip?.distance_km ? `${lastTrip.distance_km} km` : "--"}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{lastTrip?.duration ? `${lastTrip.duration} min` : lastTrip?.duration_minutes ? `${lastTrip.duration_minutes} min` : "--"}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
        </View>

        <View style={styles.paymentCard}>
          <View style={styles.paymentHeader}>
            <Ionicons name="wallet-outline" size={18} color={accent} />
            <Text style={styles.paymentTitle}>Payment</Text>
            <View style={[styles.paymentBadge, { backgroundColor: accent + "20" }]}>
              <Text style={[styles.paymentBadgeText, { color: accent }]}>{lastTrip?.payment_method || "—"}</Text>
            </View>
          </View>

          <View style={styles.barcodeWrap}>
            <View style={styles.barcode}>
              {BAR_PATTERN.map((w, i) => (
                <View
                  key={i}
                  style={[
                    styles.bar,
                    { width: w, backgroundColor: i % 2 === 0 ? "#111827" : "#D1D5DB" },
                  ]}
                />
              ))}
            </View>
          </View>

          <Text style={styles.scanHint}>Scan to verify payment</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: accent }]}
          onPress={() => navigation.navigate("DriverTabs", { screen: "DriverModeSelect" })}
        >
          <Text style={styles.primaryBtnText}>Start New Trip</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 },
  checkCircle: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, fontWeight: "500", marginBottom: 32, textAlign: "center" },
  statsCard: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    marginBottom: 32,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  statValue: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", marginTop: 2 },
  paymentCard: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    flex: 1,
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  barcodeWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  barcode: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  bar: {
    height: 38,
    marginRight: 1.5,
    borderRadius: 1,
  },
  scanHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "center",
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "800" },

  /* List mode styles */
  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    zIndex: 2,
  },
  headerMid: { flex: 1 },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700", marginTop: 1 },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyVehicleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyVehicleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  historyRouteRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  historyDots: {
    alignItems: "center",
    width: 12,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  historyDotDest: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.text,
  },
  historyLocCol: {
    flex: 1,
    gap: 6,
  },
  historyLocText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  historyLocDest: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  historyMeta: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
  },
  historyMetaItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  historyMetaLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  historyMetaValue: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  historyMetaDiv: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  historyEarnings: {
    fontSize: 15,
    fontWeight: "900",
  },
});
