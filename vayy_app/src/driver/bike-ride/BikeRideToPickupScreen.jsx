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
import { LinearGradient } from "expo-linear-gradient";
import { arrivedDispatch } from "../../store/slices/dispatchSlice";
import { getRoadDistance } from "../../routes/services/routeService";
import useWebSocket from "../../shared/hooks/useWebSocket";
import useDriverLocationPush from "../hooks/useDriverLocationPush";
import api from "../../shared/lib/api";
import { WS, OPERATIONS } from "../../constants";
import COLORS from "../../shared/constants/colors";
import VayyMap, { UserLocation, Marker } from "../../shared/components/VayyMap";
import ZoomControls from "../../shared/components/common/ZoomControls";

export default function BikeRideToPickupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatchRedux = useDispatch();
  const buddy = route.params?.buddy;
  const dispatchId = route.params?.dispatchId || buddy?.dispatchId;
  const pickupLat = Number(buddy?.pickupLat) || null;
  const pickupLng = Number(buddy?.pickupLng) || null;
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState("—");
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const [vehicleReady, setVehicleReady] = useState(false);
  const vehicleIdRef = useRef(null);
  const isInRange = distance !== null && distance <= 0.3;
  const arrivePulse = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

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
      if (pickupLat && pickupLng) {
        getRoadDistance(initLat, initLng, pickupLat, pickupLng).then((data) => {
          if (stopped) return;
          setDistance(data.distance_km);
          setEta(data.duration_min <= 1 ? "Arriving" : `${data.duration_min} min`);
        }).catch(() => {});
      }
    })();
    return () => { stopped = true; };
  }, [pickupLat, pickupLng]);

  useEffect(() => {
    if (!driverPos) return;
    const { latitude, longitude } = driverPos;
    if (pickupLat && pickupLng) {
      getRoadDistance(latitude, longitude, pickupLat, pickupLng).then((data) => {
        setDistance(data.distance_km);
        setEta(data.duration_min <= 1 ? "Arriving" : `${data.duration_min} min`);
      }).catch(() => {});
    }
  }, [driverPos, pickupLat, pickupLng]);

  useDriverLocationPush({
    enabled: vehicleReady && !!vehicleIdRef.current,
    vehicleId: vehicleIdRef.current,
    tripId: dispatchId,
    onLocation: (loc) => { setDriverPos(loc); setHeading(loc.heading); },
  });

  useEffect(() => {
    if (!driverPos || !mapRef.current) return;
    mapRef.current.setCamera({
      center: [driverPos.longitude, driverPos.latitude],
      zoom: 17,
      duration: 1500,
    });
  }, [driverPos, heading]);

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

  const confirmArrival = async () => {
    setShowArrivedModal(false);
    if (dispatchId) {
      try {
        await dispatchRedux(arrivedDispatch(dispatchId)).unwrap();
      } catch (e) {
        console.warn("arrivedDispatch failed:", e);
      }
    }
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
            zoom: 17,
          }}
        >
          <UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
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

        <LinearGradient
          colors={["rgba(10, 22, 60, 0.94)", "rgba(10, 22, 62, 0.0010)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.mapHeader, { paddingTop: insets.top + 10 }]}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride to Pickup</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
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
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  buddyMarkerActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
  },

  /* map header */
  mapHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 20,
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
    letterSpacing: -0.3,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
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
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
