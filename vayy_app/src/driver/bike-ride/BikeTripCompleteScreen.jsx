import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../shared/lib/api";
import { RIDE } from "../../constants";
import COLORS from "../../shared/constants/colors";
import { buildFareBreakdown } from "../../shared/services/fareEstimationService";

const { width } = Dimensions.get("window");

export default function BikeTripCompleteScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const buddy = route.params?.buddy || {};
  const tripData = route.params?.tripData || {};
  const dispatchId = route.params?.dispatchId || buddy?.dispatchId || tripData?.dispatch_id;

  const distanceNum = Number(buddy.distance) || Number(tripData.distance) || 0;
  const riderRating = Number(buddy.rating) || Number(tripData.rating) || 0;

  /* A journey settles one segment per rider, so the driver is shown a row per
     passenger rather than the single `buddy` the fixed-route flow passes. Falls
     back to that shape whenever `passengers` is absent, so the older route flow
     renders exactly as before. */
  const journeyPassengers = Array.isArray(tripData.passengers)
    ? tripData.passengers
    : [];
  const isJourneySummary = journeyPassengers.length > 0;
  const riders = isJourneySummary
    ? journeyPassengers.map((p, i) => ({
        key: p.boarding_request_id || p.reference || String(i),
        name: p.passenger_name || "Passenger",
        pickup: p.pickup_stop_name || "—",
        drop: p.drop_stop_name || "—",
        distance:
          p.segment_distance_m != null
            ? Number((p.segment_distance_m / 1000).toFixed(1))
            : null,
        fare: Number(p.fare || 0),
      }))
    : [];
  const journeyTotal = riders.reduce((sum, r) => sum + r.fare, 0);

  // Trip details describe the whole run, so lead with the first rider's stops
  // and fall back to the single-rider fields when there is no list.
  const lead = riders[0] || null;
  const summaryPickup = lead ? lead.pickup : buddy?.pickup;
  const summaryDrop = lead ? lead.drop : buddy?.drop;

  const [fareData, setFareData] = useState(null);

  useEffect(() => {
    if (!dispatchId) return;
    api.get(RIDE.tripFare(dispatchId)).then((res) => {
      const d = res.data?.data || res.data;
      if (d) setFareData(d);
    }).catch(() => {});
  }, [dispatchId]);

  const fare =
    fareData?.total_fare ||
    Number(buddy.fare) ||
    Number(tripData.fare) ||
    (isJourneySummary ? journeyTotal : 0);
  const breakdown = buildFareBreakdown({ distanceKm: distanceNum, vehicleType: "bike", fareData, totalFare: fare || null });
  const baseFare = breakdown.baseFare;
  const distanceFare = breakdown.distanceFare;
  const perKmRate = breakdown.perKmRate;

  const now = new Date();
  const timeStr = `${now.toLocaleDateString("en-IN", { weekday: "short" })}, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {Platform.OS === "ios" && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
        )}

        <View style={styles.successSection}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>Trip Complete</Text>
          <Text style={styles.subtitle}>Buddy dropped off safely</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.buddyRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{buddy?.avatar || "RK"}</Text>
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.buddyInfo}>
              <Text style={styles.buddyName}>{lead?.name || buddy?.name || "Passenger"}</Text>
              <Text style={styles.buddyRoute}>{summaryPickup || "Pickup"} → {summaryDrop || "Destination"}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={styles.ratingText}>{riderRating || "—"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trip Details</Text>

          <View style={styles.tripRow}>
            <View style={styles.tripDotOuter}>
              <View style={styles.tripDot} />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripLabel}>Pickup</Text>
              <Text style={styles.tripValue}>{summaryPickup || "—"}</Text>
            </View>
          </View>

          <View style={styles.tripLine} />

          <View style={styles.tripRow}>
            <View style={[styles.tripDotOuter, styles.tripDestDot]}>
              <Ionicons name="flag" size={12} color="#fff" />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripLabel}>Dropoff</Text>
              <Text style={styles.tripValue}>{summaryDrop || "—"}</Text>
            </View>
          </View>

          <View style={styles.tripMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="navigate" size={16} color="#6B7280" />
              <Text style={styles.metaText}>{distanceNum ? `${distanceNum} km` : "—"}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#6B7280" />
              <Text style={styles.metaText}>{buddy.duration ? `${buddy.duration}` : "—"}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color="#6B7280" />
              <Text style={styles.metaText}>{timeStr}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Earnings</Text>

          {isJourneySummary ? (
            <>
              {riders.map((r) => (
                <View style={styles.fareRow} key={r.key}>
                  <View style={styles.riderCell}>
                    <Text style={styles.fareLabel}>{r.name}</Text>
                    <Text style={styles.riderRoute}>
                      {r.pickup} → {r.drop}
                      {r.distance != null ? `  ·  ${r.distance} km` : ""}
                    </Text>
                  </View>
                  <Text style={styles.fareValue}>₹{r.fare ? r.fare.toFixed(2) : "—"}</Text>
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Base Fuel Share</Text>
                <Text style={styles.fareValue}>₹{baseFare || "—"}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Distance ({distanceNum ? `${distanceNum} km × ₹${perKmRate}/km` : "—"})</Text>
                <Text style={styles.fareValue}>₹{distanceFare || "—"}</Text>
              </View>
            </>
          )}
          <View style={styles.fareDivider} />
          <View style={styles.fareRow}>
            <Text style={styles.totalLabel}>Total Earned</Text>
            <Text style={styles.totalValue}>₹{fare || "—"}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Buddy Feedback</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= riderRating ? "star" : "star-outline"}
                size={32}
                color={star <= riderRating ? "#FFB800" : "#D1D5DB"}
              />
            ))}
          </View>
          <Text style={styles.feedbackText}>&quot;{buddy.feedback || "Thanks for riding!"}&quot;</Text>
          <View style={styles.feedbackAuthor}>
            <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.primary} />
            <Text style={styles.feedbackAuthorText}>— {lead?.name || buddy?.name || "Passenger"}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("DriverTabs", { screen: "DriverModeSelect" })}
          >
            <Ionicons name="bicycle" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>  Next Ride</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.secondaryBtn}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: "DriverTabs" }] })}
          >
            <Text style={styles.secondaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  successSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  buddyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#fff",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: "#fff",
  },
  buddyInfo: {
    flex: 1,
  },
  buddyName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  buddyRoute: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  tripDotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
  },
  tripDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  tripDestDot: {
    backgroundColor: COLORS.primary,
  },
  tripInfo: {
    flex: 1,
  },
  tripLabel: {
    fontSize: 12,
    color: "#888888",
    fontWeight: "500",
  },
  tripValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
  },
  tripLine: {
    width: 2,
    height: 28,
    backgroundColor: "#E5E7EB",
    marginLeft: 13,
    marginVertical: 4,
  },
  tripMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  riderCell: {
    flex: 1,
    paddingRight: 12,
  },
  riderRoute: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 2,
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  fareLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  fareValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  fareDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 18,
    marginBottom: 8,
  },
  feedbackAuthor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  feedbackAuthorText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.primary,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "700",
  },
});
