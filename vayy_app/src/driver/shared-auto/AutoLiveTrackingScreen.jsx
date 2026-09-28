import React, { useMemo, useRef, useState, useCallback } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch } from "react-redux";
import { startDispatchTrip, completeDispatch } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import VayyMap from "../../shared/components/VayyMap";
import { DEFAULT_CENTER } from "../../constants/mapConfig";
import ZoomControls from "../../shared/components/common/ZoomControls";
import COLORS from "../../shared/constants/colors";
import { colors } from "../../theme/colors";

export default function AutoLiveTrackingScreen({ navigation, route, mode = "auto" }) {
  const insets = useSafeAreaInsets();
  const dispatchRedux = useDispatch();
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.autoAccent;
  const tripData = useMemo(() => route?.params?.tripData || {}, [route?.params?.tripData]);
  const [livePassengers, setLivePassengers] = useState(Number(route?.params?.passengersOnboard) || tripData.passengersOnboard || 0);
  const [liveNextStop, setLiveNextStop] = useState(route?.params?.nextStop || tripData.nextStop || "");
  const [liveProgress, setLiveProgress] = useState(Number(route?.params?.routeProgress) || tripData.routeProgress || 0);
  const dispatchId = route?.params?.dispatchId || tripData.id;
  const otp = route?.params?.otp || tripData.otp || "";
  const [endingTrip, setEndingTrip] = useState(false);
  const [liveDistance, setLiveDistance] = useState(route?.params?.distance || tripData.distance || "");
  const [liveDuration, setLiveDuration] = useState(route?.params?.duration || tripData.duration || "");
  const initialLat = route?.params?.latitude || tripData.latitude || DEFAULT_CENTER.latitude;
  const initialLng = route?.params?.longitude || tripData.longitude || DEFAULT_CENTER.longitude;
  const [earning] = useState(Number(route?.params?.initialEarning) || 0);
  const passengerName = route?.params?.passengerName || tripData.passenger_name || "Passenger";
  const destination = route?.params?.destination || tripData.destination || null;
  const pickup = route?.params?.pickup || tripData.pickup || null;
  const mapRef = useRef(null);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleWsMessage = useCallback((data) => {
    if (data.type === "trip_update" || data.type === "vehicle_update") {
      if (data.passengers_onboard != null) setLivePassengers(data.passengers_onboard);
      if (data.next_stop) setLiveNextStop(data.next_stop);
      if (data.route_progress != null) setLiveProgress(data.route_progress);
      if (data.distance) setLiveDistance(`${data.distance}`);
      if (data.duration) setLiveDuration(`${data.duration}`);
    }
  }, []);

  useWebSocket(dispatchId ? WS.dispatch(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleWsMessage,
  });

  const handleEndTrip = useCallback(async () => {
    if (!dispatchId) {
      Alert.alert("Trip not found", "This ride has no dispatch id, so it cannot be ended.", [{ text: "OK" }]);
      return;
    }
    if (endingTrip) return;
    setEndingTrip(true);
    try {
      // startDispatchTrip expects { tripId, otp } — a bare id builds
      // /api/operations/dispatch/undefined/start/ and always 404s.
      await dispatchRedux(startDispatchTrip({ tripId: dispatchId, otp })).unwrap();
      await dispatchRedux(completeDispatch(dispatchId)).unwrap();
    } catch (error) {
      const message = error?.message || "Could not end the trip. Please try again.";
      Alert.alert("Could not end trip", message, [{ text: "OK" }]);
      setEndingTrip(false);
      return;
    }
    navigation.navigate("AutoTripComplete", {
      dispatchId,
      mode,
      tripData,
      buddy: {
        name: passengerName,
        pickup: pickup || "Pickup",
        drop: destination || "Destination",
        avatar: (passengerName || "P").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "P",
        distance: liveDistance,
        duration: liveDuration,
        fare: earning,
        rating: route?.params?.rating,
      },
      summary: { earnings: earning, distance: liveDistance, duration: liveDuration },
      stats: { earnings: earning, distance: liveDistance, duration: liveDuration, passengers: livePassengers, stops: route?.params?.stops, rating: route?.params?.rating },
    });
  }, [dispatchId, otp, endingTrip, mode, dispatchRedux, navigation, tripData, passengerName, pickup, destination, liveDistance, liveDuration, earning, livePassengers, route?.params?.stops, route?.params?.rating]);

  return (
    <View style={styles.root}>
      <VayyMap
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: initialLat,
          longitude: initialLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />
      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

      <LinearGradient
        colors={["rgba(10, 22, 60, 0.94)", "rgba(10, 22, 62, 0.0010)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Active</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={[styles.progressBar, { top: insets.top + 70 }]}>
        <View style={[styles.progressFill, { width: `${liveProgress * 100}%`, backgroundColor: accent }]} />
      </View>

      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{isBike ? "1" : `${livePassengers}`}</Text>
            <Text style={styles.statLabel}>{isBike ? "Buddy" : "On board"}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{earning}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text numberOfLines={1} style={[styles.statValue, styles.statValueNext]}>{liveNextStop || "—"}</Text>
            <Text style={styles.statLabel}>Next stop</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="navigate" size={14} color={COLORS.primary} />
          <Text style={styles.infoText}>{liveDistance || "—"} km left</Text>
          <Text style={styles.infoDot}>·</Text>
          <Ionicons name="timer" size={14} color="#F59E0B" />
          <Text style={styles.infoText}>{liveDuration || "—"}</Text>
        </View>

        <TouchableOpacity
          style={[styles.endBtn, { backgroundColor: colors.danger }, endingTrip && styles.endBtnDisabled]}
          onPress={handleEndTrip}
          disabled={endingTrip}
          activeOpacity={0.85}
        >
          <Ionicons name="stop-circle" size={20} color="#fff" />
          <Text style={styles.endBtnText}>{endingTrip ? "Ending..." : "End Trip"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F8FAF9",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 24,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  progressBar: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
    overflow: "hidden",
    zIndex: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  bottomCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  statValueNext: {
    fontSize: 13,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E5E7EB",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 14,
  },
  infoText: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "500",
  },
  infoDot: {
    fontSize: 14,
    color: "#D1D5DB",
    marginHorizontal: 4,
  },
  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    height: 50,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  endBtnDisabled: {
    opacity: 0.6,
  },
  endBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
