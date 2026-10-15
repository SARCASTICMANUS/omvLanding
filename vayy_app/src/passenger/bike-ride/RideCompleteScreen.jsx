import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Platform,
  Modal,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { submitRating } from "../../store/slices/rideSlice";
import { RIDE } from "../../constants";
import api from "../../shared/lib/api";
import { buildFareBreakdown } from "../../shared/services/fareEstimationService";

export function RideCompleteScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const [rating, setRating] = useState(0);
  const [showThankYou, setShowThankYou] = useState(false);
  const [fareData, setFareData] = useState(null);
  const { ratingLoading } = useSelector((state) => state.ride);
  const tripId = route?.params?.tripId;
  const riderName = route?.params?.riderName || "Driver";
  const vehicleText = route?.params?.vehicleText || "";
  const pickupRaw = route?.params?.pickup || "";
  const pickup = typeof pickupRaw === "string" ? pickupRaw : pickupRaw?.name || pickupRaw?.display_name || "";
  const dropoffRaw = route?.params?.dropoff || "";
  const dropoff = typeof dropoffRaw === "string" ? dropoffRaw : dropoffRaw?.name || dropoffRaw?.display_name || "";
  const distance = route?.params?.distance || "";
  const duration = route?.params?.duration || "";
  const fare = route?.params?.fare || 0;
  const driverRating = route?.params?.driverRating || 0;
  const paymentMethod = route?.params?.paymentMethod || "Fuel Share";

  useEffect(() => {
    if (!tripId) return;
    api.get(RIDE.tripFare(tripId)).then((res) => {
      const d = res.data?.data || res.data;
      if (d) setFareData(d);
    }).catch(() => {});
  }, [tripId]);

  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const handleStarPress = async (star) => {
    setRating(star);
    if (!tripId) return;
    try {
      await dispatch(submitRating({ trip: tripId, rating: star })).unwrap();
      setRatingSubmitted(true);
      setShowThankYou(true);
    } catch (error) {
      console.warn("Ride rating submission failed:", error);
    }
  };

  const now = new Date();
  const timeStr = `${now.toLocaleDateString("en-IN", { weekday: "short" })}, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;

  const distNum = typeof distance === "string" ? parseFloat(distance) || 0 : distance || 0;
  const distKm = distNum > 1000 ? parseFloat((distNum / 1000).toFixed(1)) : distNum;
  const breakdown = buildFareBreakdown({
    distanceKm: distKm,
    vehicleType: "bike",
    fareData,
    totalFare: Number(fareData?.total_fare) || Number(fare) || null,
  });
  const fareConfirmed = fareData?.settled === true && fareData?.total_fare != null;
  const totalFare = fareConfirmed ? breakdown.totalFare : "—";
  const baseFare = fareConfirmed ? breakdown.baseFare : "—";
  const distanceFare = fareConfirmed ? breakdown.distanceFare : "—";
  const perKmRate = fareConfirmed ? breakdown.perKmRate : null;

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
          <Text style={styles.title}>Ride Complete</Text>
          <Text style={styles.subtitle}>You&apos;ve reached your destination safely</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{riderName.charAt(0)}</Text>
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{riderName}</Text>
              <Text style={styles.vehicleText}>{vehicleText}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={styles.ratingText}>{driverRating || "—"}</Text>
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
              <Text style={styles.tripValue}>{pickup}</Text>
            </View>
          </View>

          <View style={styles.tripLine} />

          <View style={styles.tripRow}>
            <View style={[styles.tripDotOuter, styles.tripDestDot]}>
              <Ionicons name="flag" size={12} color="#FFFFFF" />
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.tripLabel}>Dropoff</Text>
              <Text style={styles.tripValue}>{dropoff}</Text>
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
          <Text style={styles.sectionTitle}>Fuel Share Breakdown</Text>

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Base Fuel Share</Text>
            <Text style={styles.fareValue}>₹{baseFare}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Distance ({fareConfirmed && distKm > 0 ? distKm + " km × ₹" + perKmRate + "/km" : "—"})</Text>
            <Text style={styles.fareValue}>₹{distanceFare}</Text>
          </View>
          <View style={styles.fareDivider} />

          <View style={styles.fareRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{totalFare}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.paymentBadgeRow}>
            <View style={styles.paymentBadge}>
              <Ionicons name="wallet" size={16} color="#009849" />
              <Text style={styles.paymentBadgeText}>Payment method: {paymentMethod}</Text>
            </View>
            <Text style={styles.paymentAmount}>₹{totalFare}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rate Your Ride</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={36}
                  color={star <= rating ? "#FFB800" : "#D1D5DB"}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingHint}>
              {rating === 1 ? "Poor" : rating === 2 ? "Below Average" : rating === 3 ? "Average" : rating === 4 ? "Good" : "Excellent"}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.primaryBtn, ratingLoading && { opacity: 0.6 }]}
            disabled={ratingLoading}
            onPress={async () => {
              if (rating > 0 && !ratingSubmitted) {
                if (!tripId) return;
                try {
                  await dispatch(submitRating({ trip: tripId, rating })).unwrap();
                } catch (error) {
                  console.warn("Ride rating submission failed:", error);
                  return;
                }
              }
              navigation.navigate('BikeMapPreRide');
            }}
          >
            <Image source={require("../../../assets/vayyFrontBike.webp")} style={{ width: 20, height: 20 }} resizeMode="contain" />
            <Text style={styles.primaryBtnText}>  Book Another Ride</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.secondaryBtn}
            onPress={async () => {
              if (rating > 0 && !ratingSubmitted) {
                if (!tripId) return;
                try {
                  await dispatch(submitRating({ trip: tripId, rating })).unwrap();
                } catch (error) {
                  console.warn("Ride rating submission failed:", error);
                  return;
                }
              }
              navigation.reset({ index: 0, routes: [{ name: "PassengerTabs" }] });
            }}
          >
            <Text style={styles.secondaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showThankYou} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.thankYouModal}>
            <View style={styles.thankYouIcon}>
              <Ionicons name="heart" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.thankYouTitle}>Thank You!</Text>
            <Text style={styles.thankYouMsg}>
              Your feedback helps us improve the experience for everyone.
            </Text>
            <TouchableOpacity
              style={styles.thankYouBtn}
              activeOpacity={0.9}
              onPress={() => setShowThankYou(false)}
            >
              <Text style={styles.thankYouBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: "800",
    color: "#009849",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#009849",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  vehicleText: {
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
    backgroundColor: "#009849",
  },
  tripDestDot: {
    backgroundColor: "#009849",
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
    color: "#009849",
  },
  paymentBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FAF2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  paymentBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#009849",
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  thankYouModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  thankYouIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  thankYouTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  thankYouMsg: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  thankYouBtn: {
    height: 52,
    borderRadius: 18,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  thankYouBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
});
