import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";
import { fetchRideHistory } from "../../store/slices/rideSlice";

export default function DriverTripHistoryScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { mode = "bike" } = route?.params || {};
  const accent = mode === "auto" ? "#BA7517" : "#009849";
  const { history, historyLoading } = useSelector((state) => state.ride);
  const lastTrip = history?.[0];

  useEffect(() => {
    dispatch(fetchRideHistory({ status: "completed", page: 1 }));
  }, [dispatch]);

  if (historyLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.container, { justifyContent: "center" }]}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark-circle" size={64} color={accent} />
        </View>
        <Text style={styles.title}>Trip Complete</Text>
        <Text style={styles.subtitle}>
          {lastTrip?.route_name || "You've reached your destination safely"}
        </Text>

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

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: accent }]}
          onPress={() => navigation.navigate("DriverModeSelect")}
        >
          <Text style={styles.primaryBtnText}>Start New Trip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
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
  primaryBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "800" },
});
