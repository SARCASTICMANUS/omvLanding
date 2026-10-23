import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import * as Location from "expo-location";
import { arrivedDispatch, cancelBoardingRequest, cancelDispatch } from "../../store/slices/dispatchSlice";
import { getRoadDirections } from "../../routes/services/routeService";
import useWebSocket from "../../shared/hooks/useWebSocket";
import useDriverLocationPush from "../hooks/useDriverLocationPush";
import api from "../../shared/lib/api";
import { WS, OPERATIONS } from "../../constants";
import COLORS from "../../shared/constants/colors";
import VayyMap, { UserLocation, Marker, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import ZoomControls from "../../shared/components/common/ZoomControls";

const turnLabel = (step) => {
  const modifier = step?.modifier || "straight";
  if (modifier.includes("left")) return "Turn left";
  if (modifier.includes("right")) return "Turn right";
  if (modifier === "uturn") return "Make a U-turn";
  if (step?.type === "roundabout" || step?.type === "rotary") return "Enter roundabout";
  if (step?.type === "arrive") return "Arrive at pickup";
  return "Continue straight";
};

const distanceBetween = (a, b) => {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const bearingBetween = (a, b) => {
  const rad = (deg) => (deg * Math.PI) / 180;
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const routeBearingAtPosition = (coordinates, position) => {
  if (!coordinates || coordinates.length < 2) return null;
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const [lng1, lat1] = coordinates[index];
    const [lng2, lat2] = coordinates[index + 1];
    const distance = distanceToSegment(position.longitude, position.latitude, lng1, lat1, lng2, lat2);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }
  return bearingBetween(coordinates[nearestIndex], coordinates[nearestIndex + 1]);
};

const PICKUP_NAVIGATION_ZOOM = 19;

export default function BikeRideToPickupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatchRedux = useDispatch();
  const buddy = route.params?.buddy;
  const dispatchId = route.params?.dispatchId || buddy?.dispatchId;
  const pickupLat = Number(buddy?.pickupLat) || null;
  const pickupLng = Number(buddy?.pickupLng) || null;
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const lastDirectionsRequest = useRef(null);
  const directionsRequestId = useRef(0);
  const passedTurnCount = useRef(0);
  const [mapCenter, setMapCenter] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState("—");
  const [approachPath, setApproachPath] = useState(null);
  const [turnSteps, setTurnSteps] = useState([]);
  const [directionsError, setDirectionsError] = useState("");
  const [turnIndex, setTurnIndex] = useState(0);
  const [turnDistance, setTurnDistance] = useState(null);
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellingRide, setCancellingRide] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const allowExitRef = useRef(false);
  const cancelInProgressRef = useRef(false);
  const [vehicleReady, setVehicleReady] = useState(false);
  const vehicleIdRef = useRef(null);
  const isInRange = distance !== null && distance <= 0.3;
  const arrivePulse = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (allowExitRef.current) return;
    event.preventDefault();
    setShowCancelConfirm(true);
  }), [navigation]);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const res = await api.get(OPERATIONS.vehiclesMe);
        vehicleIdRef.current = res?.data?.data?.id || res?.data?.id || res?.id;
        setVehicleReady(true);
      } catch {}
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || stopped) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (stopped) return;
      const initLat = pos.coords.latitude;
      const initLng = pos.coords.longitude;
      setDriverPos({ latitude: initLat, longitude: initLng });
      setMapCenter({ latitude: initLat, longitude: initLng });
    })();
    return () => { stopped = true; };
  }, [pickupLat, pickupLng]);

  useEffect(() => {
    if (!driverPos) return;
    const { latitude, longitude } = driverPos;
    if (!pickupLat || !pickupLng) return;
    const now = Date.now();
    const previous = lastDirectionsRequest.current;
    if (previous && now - previous.time < 12000 && distanceBetween([longitude, latitude], previous.point) < 100) return;
    lastDirectionsRequest.current = { time: now, point: [longitude, latitude] };
    const requestId = ++directionsRequestId.current;
    getRoadDirections(latitude, longitude, pickupLat, pickupLng).then((data) => {
      if (requestId !== directionsRequestId.current) return;
      setDistance(Number(data.distance) / 1000);
      setEta(Number(data.duration) <= 60 ? "Arriving" : `${Math.max(1, Math.round(Number(data.duration) / 60))} min`);
      setApproachPath(data.geometry?.coordinates || null);
      setDirectionsError("");
      const turns = (data.steps || []).filter((step) => !["depart", "notification"].includes(step.type));
      setTurnSteps(turns);
      passedTurnCount.current = 0;
      setTurnIndex(0);
    }).catch((error) => {
      setDirectionsError(error?.message || "Check your connection and try again.");
      if (__DEV__) console.warn("Pickup navigation directions unavailable:", error?.message || error);
    });
  }, [driverPos, pickupLat, pickupLng]);

  useEffect(() => {
    const step = turnSteps[turnIndex];
    if (!step || !driverPos || !Array.isArray(step.location)) return;
    const meters = distanceBetween([driverPos.longitude, driverPos.latitude], step.location);
    setTurnDistance(meters);
    if (meters < 35 && turnIndex < turnSteps.length - 1 && passedTurnCount.current !== turnIndex) {
      passedTurnCount.current = turnIndex;
      setTurnIndex((index) => Math.min(index + 1, turnSteps.length - 1));
    }
  }, [driverPos, turnIndex, turnSteps]);

  useDriverLocationPush({
    enabled: vehicleReady && !!vehicleIdRef.current,
    vehicleId: vehicleIdRef.current,
    tripId: dispatchId,
    onLocation: (loc) => { setDriverPos(loc); setHeading(loc.heading); },
  });

  useEffect(() => {
    if (!driverPos || !mapRef.current) return;
    const routeBearing = routeBearingAtPosition(approachPath, driverPos);
    mapRef.current.setCamera({
      center: [driverPos.longitude, driverPos.latitude],
      zoom: PICKUP_NAVIGATION_ZOOM,
      pitch: 50,
      bearing: routeBearing ?? heading,
      duration: 1500,
    });
  }, [driverPos, heading, approachPath]);

  useEffect(() => {
    if (isInRange) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(arrivePulse, { toValue: 0.6, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(arrivePulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isInRange, arrivePulse]);

  useEffect(() => {
    const dots = [dot1, dot2, dot3];
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 300),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dot1, dot2, dot3]);

  const handleWsMessage = useCallback((data) => {
    if (data.status === "cancelled" || data.status === "completed") {
      if (cancelInProgressRef.current) return;
      allowExitRef.current = true;
      navigation.navigate("DriverTabs");
    }
  }, [navigation]);

  useWebSocket(dispatchId ? WS.dispatch(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleWsMessage,
  });

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleArrived = () => setShowArrivedModal(true);

  const cancelAcceptedRide = async () => {
    if (cancelInProgressRef.current) return;
    cancelInProgressRef.current = true;
    setCancellingRide(true);
    setCancelError("");
    try {
      if (buddy?.boardingRequestId) {
        await dispatchRedux(cancelBoardingRequest(buddy.boardingRequestId)).unwrap();
      } else if (dispatchId) {
        await dispatchRedux(cancelDispatch(dispatchId)).unwrap();
      } else {
        throw new Error("The accepted ride could not be identified.");
      }
      allowExitRef.current = true;
      setShowCancelConfirm(false);
      navigation.navigate("FindPassenger", { cancelAcceptedRide: true });
    } catch (error) {
      console.warn("Cancel accepted ride failed:", error);
      setCancelError(error?.message || "Could not cancel the ride. Please try again.");
    } finally {
      cancelInProgressRef.current = false;
      setCancellingRide(false);
    }
  };

  const confirmArrival = async () => {
    setShowArrivedModal(false);
    if (dispatchId) {
      try {
        await dispatchRedux(arrivedDispatch({
          tripId: dispatchId,
          boardingRequestId: buddy?.boardingRequestId,
        })).unwrap();
      } catch (e) {
        console.warn("arrivedDispatch failed:", e);
      }
    }
    allowExitRef.current = true;
    navigation.navigate("BikeOTPEntry", { buddy, dispatchId });
  };

  return (
    <View style={styles.root}>
      {/* Map area */}
      <View style={styles.mapArea}>
        {!mapCenter ? (
          <View style={styles.gpsLoading}>
            <Text style={styles.gpsLoadingText}>Getting your location...</Text>
          </View>
        ) : (
        <VayyMap
          ref={mapRef}
          cameraRef={cameraRef}
          style={styles.mapBg}
          initialViewState={{
            center: [mapCenter.longitude, mapCenter.latitude],
            zoom: PICKUP_NAVIGATION_ZOOM,
            pitch: 50,
          }}
        >
          <UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
          {approachPath?.length > 1 && (
            <GeoJSONSource id="pickupApproach" data={{ type: "Feature", geometry: { type: "LineString", coordinates: approachPath } }}>
              <Layer id="pickupApproachLine" type="line" layout={{ "line-join": "round", "line-cap": "round" }} paint={{ "line-color": COLORS.primary, "line-width": 6 }} />
            </GeoJSONSource>
          )}
          {pickupLng && pickupLat && (
            <Marker
              id="pickup"
              lngLat={[pickupLng, pickupLat]}
            >
              <View style={styles.buddyMarkerWrap}>
                <View style={styles.buddyPulseRing} />
                <View style={[styles.buddyMarker, isInRange && styles.buddyMarkerActive]} />
              </View>
            </Marker>
          )}
        </VayyMap>
        )}

        <ScreenHeader
          absolute
          zIndex={20}
          title="Ride to Pickup"
          subtitle="Head to the passenger's boarding stop"
          onBack={() => setShowCancelConfirm(true)}
        />
        {!!turnSteps[turnIndex] || !!directionsError ? (
          <View style={styles.turnCard}>
            <Ionicons name={directionsError ? "alert-circle-outline" : turnLabel(turnSteps[turnIndex]).includes("left") ? "arrow-undo" : turnLabel(turnSteps[turnIndex]).includes("right") ? "arrow-redo" : "arrow-up"} size={28} color="#fff" />
            <View style={styles.turnTextWrap}>
              <Text style={styles.turnTitle}>{directionsError ? "Directions unavailable" : turnLabel(turnSteps[turnIndex])}</Text>
              <Text style={styles.turnSubtitle}>
                {directionsError ? "Check your connection; guidance will retry." : `${turnDistance == null ? "Follow the road" : turnDistance >= 1000 ? `${(turnDistance / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(turnDistance))} m`}${turnSteps[turnIndex].name ? ` · ${turnSteps[turnIndex].name}` : ""}`}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        <View style={styles.buddyRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buddy?.avatar || "-"}</Text>
          </View>
          <View style={styles.buddyInfo}>
            <Text style={styles.buddyName}>{buddy?.name || "-"}</Text>
            <Text style={styles.buddyPickup}>{buddy?.pickup || "-"}</Text>
          </View>
          <View style={styles.etaBadge}>
            <Ionicons name="time" size={13} color={COLORS.primary} />
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        </View>

        <View style={styles.distSection}>
          <View style={styles.distHeader}>
            <Ionicons name="location" size={14} color={COLORS.primary} />
            <Text style={styles.distValue}>{distance != null ? distance.toFixed(2) : "—"} km</Text>
            <Text style={styles.distLabel}>to pickup</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(distance / 1.2 * 100)}%`,
                  backgroundColor:
                    distance <= 1 ? COLORS.primary :
                    distance <= 3 ? "#22C55E" :
                    distance <= 5 ? "#F59E0B" : "#EF4444",
                },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>-</Text>
            <Text style={[styles.progressLabel, { color: COLORS.primary }]}>- km</Text>
          </View>
        </View>

        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>Heading to pickup</Text>
          <View style={styles.dotRow}>
            {[dot1, dot2, dot3].map((dot, i) => (
              <Animated.View
                key={i}
                style={[styles.loadingDot, { opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }]}
              />
            ))}
          </View>
        </View>

        {!isInRange && (
          <View style={styles.arriveHint}>
            <Ionicons name="radio" size={14} color="#9CA3AF" />
            <Text style={styles.arriveHintText}>Arrive within - m to activate</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.arrivedBtn, !isInRange && styles.arrivedBtnDisabled]}
          onPress={isInRange ? handleArrived : null}
          activeOpacity={isInRange ? 0.85 : 1}
          disabled={!isInRange}
        >
          <Animated.View style={[styles.arriveBtnInner, { opacity: isInRange ? arrivePulse : 0.5 }]}>
            <Ionicons name="flag" size={20} color="#fff" />
            <Text style={styles.arrivedBtnText}>I&apos;ve Arrived at Pickup</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Modal visible={showArrivedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="checkmark-circle" size={52} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Confirm Arrival</Text>
            <Text style={styles.modalDesc}>
              Have you reached{"\n"}
              <Text style={{ fontWeight: "700" }}>{buddy?.pickup || "the pickup point"}</Text>?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowArrivedModal(false)}>
                <Text style={styles.modalCancelText}>Not Yet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmArrival}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.modalConfirmText}>Yes, I&apos;m Here</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCancelConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning-outline" size={48} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Cancel accepted ride?</Text>
            <Text style={styles.modalDesc}>
              The passenger will be notified and this pickup will be removed from your trip.
            </Text>
            {!!cancelError && <Text style={styles.cancelError}>{cancelError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowCancelConfirm(false); setCancelError(""); }}
                disabled={cancellingRide}
              >
                <Text style={styles.modalCancelText}>Keep Ride</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, styles.modalConfirmDanger]}
                onPress={cancelAcceptedRide}
                disabled={cancellingRide}
              >
                <Text style={styles.modalConfirmText}>{cancellingRide ? "Cancelling…" : "Cancel Ride"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },

  /* map */
  mapArea: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  turnCard: {
    position: "absolute",
    top: 104,
    left: 16,
    right: 16,
    zIndex: 15,
    minHeight: 68,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#17372B",
    boxShadow: "0 3 12 rgba(0,0,0,0.22)",
  },
  turnTextWrap: { flex: 1 },
  turnTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  turnSubtitle: { color: "#D1FAE5", fontSize: 13, marginTop: 3 },
  gpsLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsLoadingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  buddyMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  buddyPulseRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  buddyMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    boxShadow: "0 0 8 rgba(239, 68, 68, 0.5)",
  },
  buddyMarkerActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
  },

  /* bottom sheet */
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 15,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },

  /* buddy */
  buddyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },
  buddyInfo: {
    flex: 1,
  },
  buddyName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  buddyPickup: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 2,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFAF1",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },

  /* distance */
  distSection: {
    marginBottom: 12,
  },
  distHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  distValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  distLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  /* loading */
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  dotRow: {
    flexDirection: "row",
    gap: 3,
  },
  loadingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#6B7280",
  },

  /* arrive hint */
  arriveHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  arriveHintText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  /* arrived button */
  arrivedBtn: {
    borderRadius: 18,
    height: 56,
    overflow: "hidden",
  },
  arriveBtnInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
  },
  arrivedBtnDisabled: {
    opacity: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  arrivedBtnText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },


  /* modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: "center",
    gap: 12,
    boxShadow: "0 4 30 rgba(0, 0, 0, 0.15)",
  },
  modalIconWrap: {
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  modalDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  cancelError: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  modalCancel: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7280",
  },
  modalConfirm: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 14,
  },
  modalConfirmDanger: { backgroundColor: "#EF4444" },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
