import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import VayyMap from "../../shared/components/VayyMap";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import { completeDispatch } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import { DEFAULT_CENTER } from "../../constants/mapConfig";

const DESTINATION_THRESHOLD = 100;

function haversine(a, b) {
  const R = 6371e3;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function AutoRideActiveScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatchRedux = useDispatch();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const lastCoordsRef = useRef(null);
  const [speed, setSpeed] = useState(null);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEarlyEnd, setShowEarlyEnd] = useState(false);
  const [endRideLoading, setEndRideLoading] = useState(false);

  const destinationRaw = route?.params?.destination || "Destination";
  const destination = typeof destinationRaw === "string" ? destinationRaw : destinationRaw?.name || destinationRaw?.display_name || "Destination";
  const dispatchId = route?.params?.dispatchId || "";
  const fare = route?.params?.fare || "—";
  const distanceLeft = route?.params?.distance || "—";
  const eta = route?.params?.eta || "—";
  const driverName = route?.params?.driverName || "Auto Driver";
  const vehicle = route?.params?.vehicle || "";
  const tripData = route?.params?.tripData || {};
  const route_id = route?.params?.route_id || "";

  const atDestination = remainingDistance != null && remainingDistance <= DESTINATION_THRESHOLD;
  const progress = remainingDistance != null && distanceLeft !== "—"
    ? Math.max(0, Math.min(100, ((Number(distanceLeft) - remainingDistance) / Number(distanceLeft)) * 100))
    : 0;

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleRecenter = () => {
    if (!lastCoordsRef.current) return;
    mapRef.current?.setCamera({
      center: [lastCoordsRef.current.longitude, lastCoordsRef.current.latitude],
      zoom: 17,
      duration: 1200,
    });
  };

  const handleWsMessage = useCallback((data) => {
    if (data?.type === "trip_completed") {
      navigation.navigate("AutoRideComplete", {
        tripId: data.trip_id || dispatchId,
        boardedAt: "",
        droppedAt: "",
        distance: distanceLeft,
        duration: eta,
        fare,
        paymentMethod: "Fuel Share",
        route_id,
      });
    }
  }, [dispatchId, distanceLeft, eta, fare, route_id, navigation]);

  useWebSocket(dispatchId ? WS.dispatch(dispatchId) : null, {
    onMessage: handleWsMessage,
  });

  useEffect(() => {
    let removed = false;
    let sub = null;
    import("../../shared/lib/locationService").then(({ default: locationService }) => {
      if (removed) return;
      let prevPos = null;
      locationService.startTracking((coords) => {
        if (removed) return;
        const pos = { latitude: coords.latitude, longitude: coords.longitude };
        lastCoordsRef.current = pos;
        if (prevPos) {
          const dist = haversine(prevPos, pos);
          setRemainingDistance((d) => d != null ? Math.max(0, d - dist) : null);
          setSpeed(coords.speed != null ? Math.round(coords.speed * 3.6) : null);
        } else if (distanceLeft !== "—") {
          setRemainingDistance(Number(distanceLeft) || null);
        }
        prevPos = pos;
      }, { distanceInterval: 10, timeInterval: 3000 }).then((s) => { sub = s; });
    });
    return () => { removed = true; if (sub?.remove) sub.remove(); };
  }, []);

  const handleEndRide = () => {
    if (atDestination) {
      setShowEndConfirm(true);
    } else {
      setShowEarlyEnd(true);
    }
  };

  const confirmEndRide = async () => {
    setShowEndConfirm(false);
    setEndRideLoading(true);
    const tripId = tripData.trip_id || dispatchId;
    try {
      await dispatchRedux(completeDispatch(tripId)).unwrap();
    } catch (e) {
      console.warn("completeDispatch auto passenger end ride failed:", e);
    }
    navigation.replace('AutoRideComplete', {
      tripId,
      boardedAt: "",
      droppedAt: "",
      distance: distanceLeft,
      duration: eta,
      fare,
      paymentMethod: "Fuel Share",
      route_id,
    });
  };

  const confirmEarlyEnd = () => {
    setShowEarlyEnd(false);
    confirmEndRide();
  };

  const destinationLabel = remainingDistance != null
    ? remainingDistance >= 1000
      ? `${(remainingDistance / 1000).toFixed(1)} km`
      : `${remainingDistance} m`
    : "—";

  const etaMinutes = remainingDistance != null ? Math.max(1, Math.round(remainingDistance / 200)) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          ref={mapRef}
          cameraRef={cameraRef}
          initialRegion={{
            latitude: DEFAULT_CENTER.latitude,
            longitude: DEFAULT_CENTER.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
          zoomControlEnabled={true}
        />

        <ScreenHeader
          absolute
          zIndex={20}
          title="Ride Active"
          subtitle="Enjoy your trip"
        />

        <View style={styles.floatingContainer}>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomIn}>
            <Ionicons name="add" size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomOut}>
            <Ionicons name="remove" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.floatDivider} />
          <TouchableOpacity style={styles.floatBtn} onPress={handleRecenter}>
            <MaterialIcons name="my-location" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.destLabel}>
          <Ionicons name="location" size={16} color="#009849" />
          <Text style={styles.destLabelText}>{destination}</Text>
        </View>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Route Progress</Text>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="speedometer" size={20} color="#009849" />
            <Text style={styles.statValue}>{speed ?? "—"}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="location" size={20} color="#009849" />
            <Text style={styles.statValue}>{destinationLabel}</Text>
            <Text style={styles.statLabel}>left</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="time-outline" size={20} color="#009849" />
            <Text style={styles.statValue}>{etaMinutes ?? "—"}</Text>
            <Text style={styles.statLabel}>min left</Text>
          </View>
        </View>

        <View style={styles.nextStopCard}>
          <Ionicons name="flag" size={16} color="#009849" />
          <Text style={styles.nextStopText}>
            Destination: <Text style={styles.nextStopBold}>{destination}</Text>
          </Text>
        </View>

        <TouchableOpacity style={styles.endRideBtn} onPress={handleEndRide}>
          <Ionicons name="stop-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.endRideText}>End Ride</Text>
        </TouchableOpacity>
      </View>

      {showEndConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color="#009849" />
            </View>
            <Text style={styles.modalTitle}>End Ride?</Text>
            <Text style={styles.modalMessage}>
              Looks like you've reached your destination.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowEndConfirm(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={confirmEndRide}
              >
                <Text style={styles.modalBtnPrimaryText}>End Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showEarlyEnd && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconWrap, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="warning-outline" size={40} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>You Have Not Reached Your Destination</Text>
            <Text style={styles.modalMessage}>
              You are still {destinationLabel} away from your selected destination.{'\n\n'}
              Are you sure you want to end this ride?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowEarlyEnd(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Continue Ride</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: "#EF4444" }]}
                onPress={confirmEarlyEnd}
              >
                <Text style={styles.modalBtnPrimaryText}>End Ride Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", backgroundColor: "#F8FAF9" },
  mapArea: { ...StyleSheet.absoluteFillObject, backgroundColor: "#F9FAFB" },
  mapBg: { ...StyleSheet.absoluteFillObject },
  floatingContainer: {
    position: "absolute", right: 20, bottom: 30, alignItems: "center",
    borderRadius: 32, backgroundColor: "#FFFFFF", paddingVertical: 8,
    zIndex: 10,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  floatBtn: {
    width: 56, height: 48, justifyContent: "center", alignItems: "center",
  },
  floatDivider: {
    width: 28, height: 1, backgroundColor: "#E5E7EB", alignSelf: "center",
  },
  destLabel: {
    position: "absolute", bottom: 120, left: 20,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  destLabelText: { fontSize: 13, fontWeight: "700", color: "#111827" },
  bottomSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 15,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB",
    alignSelf: "center", marginBottom: 20,
  },
  progressSection: { marginBottom: 16 },
  progressHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
  },
  progressTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  progressPercent: { fontSize: 15, fontWeight: "800", color: "#009849" },
  progressBar: {
    width: "100%", height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#009849", borderRadius: 3 },
  statsRow: {
    flexDirection: "row", backgroundColor: "#F9FAFB", borderRadius: 16,
    padding: 16, marginBottom: 16, alignItems: "center",
  },
  statCol: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 22, fontWeight: "900", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  statDivider: { width: 1, height: 32, backgroundColor: "#E5E7EB" },
  nextStopCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ECFAF1", borderRadius: 12, padding: 12, marginBottom: 16,
  },
  nextStopText: { fontSize: 13, color: "#374151", fontWeight: "500", flex: 1 },
  nextStopBold: { fontWeight: "800", color: "#111827" },
  endRideBtn: {
    height: 56, borderRadius: 18, backgroundColor: "#EF4444",
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
    shadowColor: "#EF4444", shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  endRideText: { fontSize: 17, fontWeight: "900", color: "#FFFFFF" },
  modalOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center",
    zIndex: 100, paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24,
    width: "100%", maxWidth: 340, alignItems: "center",
  },
  modalIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#ECFAF1",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 8, textAlign: "center" },
  modalMessage: {
    fontSize: 14, color: "#6B7280", fontWeight: "500", textAlign: "center",
    lineHeight: 20, marginBottom: 24,
  },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtnSecondary: {
    flex: 1, height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: "#E5E7EB",
    justifyContent: "center", alignItems: "center",
  },
  modalBtnSecondaryText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  modalBtnPrimary: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: "#009849",
    justifyContent: "center", alignItems: "center",
  },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
});
