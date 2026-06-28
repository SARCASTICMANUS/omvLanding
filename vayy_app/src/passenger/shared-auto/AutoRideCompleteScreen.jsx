import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { submitRating } from "../../store/slices/rideSlice";

const { width } = Dimensions.get("window");

const RATING_LABELS = {
  1: "Poor",
  2: "Below Average",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

export function AutoRideCompleteScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const [rating, setRating] = useState(0);
  const { ratingLoading } = useSelector((state) => state.ride);
  const tripId = route?.params?.tripId;
  const boardedAt = route?.params?.boardedAt || "";
  const droppedAt = route?.params?.droppedAt || "";
  const distance = route?.params?.distance || "";
  const duration = route?.params?.duration || "";
  const fare = route?.params?.fare || 0;
  const paymentMethod = route?.params?.paymentMethod || "Cash";

  const now = new Date();
  const timeStr = `${now.toLocaleDateString("en-IN", { weekday: "short" })}, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;

  const ratingHint = rating <= 2
    ? "Sorry about your experience"
    : rating === 3
    ? "Thanks for your feedback"
    : rating === 4
    ? "Glad you enjoyed the ride"
    : "Amazing! Thank you";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
        )}

        <View style={styles.successSection}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Trip Complete</Text>
          <Text style={styles.subtitle}>You've reached your destination safely</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trip Details</Text>

          <View style={styles.tripRow}>
            <View style={styles.tripDotOuter}>
              <View style={[styles.tripDot, { backgroundColor: "#009849" }]} />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripLabel}>Boarded at</Text>
              <Text style={styles.tripValue}>{boardedAt}</Text>
            </View>
          </View>

          <View style={styles.tripLine} />

          <View style={styles.tripRow}>
            <View style={[styles.tripDotOuter, { backgroundColor: "#009849" }]}>
              <Ionicons name="flag" size={12} color="#FFFFFF" />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripLabel}>Dropped at</Text>
              <Text style={styles.tripValue}>{droppedAt}</Text>
            </View>
          </View>

          <View style={styles.tripMeta}>
            <View style={styles.metaItem}>
              <MaterialIcons name="straighten" size={18} color="#6B7280" />
              <Text style={styles.metaText}>{distance}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={18} color="#6B7280" />
              <Text style={styles.metaText}>{duration}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              <Text style={styles.metaText}>{timeStr}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fare</Text>
          <View style={styles.fareDisplay}>
            <Text style={styles.fareAmount}>₹{fare || "—"}</Text>
            <Text style={styles.fareNote}>Shared auto fare</Text>
            <View style={styles.paymentBadge}>
              <Ionicons name="cash" size={14} color="#009849" />
              <Text style={styles.paymentText}>Paid via {paymentMethod}</Text>
            </View>
          </View>
          <View style={styles.fareBreakdown}>
            <View style={styles.fareRow}>
              <Text style={styles.fareRowLabel}>Estimated fare</Text>
              <Text style={styles.fareRowValue}>₹{fare || "—"}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareRowLabel}>Distance travelled</Text>
              <Text style={styles.fareRowValue}>{distance || "—"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rate Your Trip</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                <View style={styles.starItem}>
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={36}
                    color={star <= rating ? "#FFB800" : "#D1D5DB"}
                  />
                  <Text style={[styles.starLabel, star <= rating && styles.starLabelActive]}>
                    {RATING_LABELS[star]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingHint}>{ratingHint}</Text>
          )}
          {rating === 0 && (
            <Text style={styles.ratingSkip}>Tap a star to rate, or skip to finish</Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.primaryBtn, ratingLoading && { opacity: 0.6 }]}
            disabled={ratingLoading}
            onPress={async () => {
              if (rating > 0 && tripId) {
                await dispatch(submitRating({ trip: tripId, rating }));
              }
              navigation.navigate('AutoPreRide');
            }}
          >
            <Ionicons name="car-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>  Book Another Auto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.secondaryBtn}
            onPress={async () => {
              if (rating > 0 && tripId) {
                await dispatch(submitRating({ trip: tripId, rating }));
              }
              navigation.popToTop();
            }}
          >
            <Text style={styles.secondaryBtnText}>Return Home</Text>
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#009849",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
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
  fareDisplay: {
    alignItems: "center",
    paddingVertical: 8,
  },
  fareAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#009849",
  },
  fareNote: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 6,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFAF1",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  paymentText: {
    fontSize: 13,
    color: "#009849",
    fontWeight: "700",
  },
  fareBreakdown: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 10,
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fareRowLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  fareRowValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "700",
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  starItem: {
    alignItems: "center",
    gap: 4,
  },
  starLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  starLabelActive: {
    color: "#FFB800",
  },
  ratingSkip: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 12,
  },
  ratingHint: {
    textAlign: "center",
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: 12,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#009849",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#009849",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
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
