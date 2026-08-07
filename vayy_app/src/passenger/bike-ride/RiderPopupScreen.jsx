import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Image,
  Animated,
  Easing,
  Modal,
} from "react-native";
import VayyMap, { UserLocation, Marker, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import * as Location from "expo-location";
import { fetchRouteGeometry } from "../../routes/services/routeService";
import { cancelDispatch } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import { ConfirmPopup } from "./ConfirmPopup";
import SmoothMarker from "../../shared/components/common/SmoothMarker";

export function RiderPopupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const driverName = route?.params?.driverName || "Driver";
  const vehicle = route?.params?.vehicle || "";
  const dispatchId = route?.params?.dispatchId;
  const destination = route?.params?.destination || "Destination";
  const pickupStr = route?.params?.pickup || "Pickup";
  const routeId = route?.params?.route_id;
  const fare = route?.params?.fare || "—";
  const driverRating = route?.params?.driverRating || route?.params?.tripData?.driver_rating || null;
  const rawOtp = route?.params?.otp;
  const otpDigits = rawOtp && rawOtp !== "—" ? String(rawOtp).split("") : ["", "", "", ""];

  const [routePath, setRoutePath] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [driverPos, setDriverPos] = useState(null);
  const [passengerPos, setPassengerPos] = useState(null);
  const [distance, setDistance] = useState(route?.params?.distance || "—");
  const [eta, setEta] = useState(route?.params?.eta || "—");
  const [mapCenter, setMapCenter] = useState(null);
  const navigatingRef = useRef(false);
  const [arrivedPhase, setArrivedPhase] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let stopped = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || stopped) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (stopped) return;
      const { latitude, longitude } = pos.coords;
      setPassengerPos({ latitude, longitude });
      setMapCenter({ latitude, longitude });
    })();
    return () => { stopped = true; };
  }, []);

  const goToRideStats = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    const params = {
      driverName,
      vehicle,
      dispatchId,
      destination,
      eta,
      distance,
      fare,
      route_id: routeId,
      tripData: route?.params?.tripData || {},
    };
    if (arrivedPhase === "waiting") {
      setArrivedPhase("verified");
      checkScale.setValue(0);
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 40,
        friction: 5,
        useNativeDriver: true,
      }).start();
      setTimeout(() => navigation.navigate("RideStats", params), 1600);
    } else {
      navigation.navigate("RideStats", params);
    }
  }, [navigation, driverName, vehicle, dispatchId, destination, eta, distance, fare, routeId, arrivedPhase, checkScale]);

  useEffect(() => {
    if (eta === "Arriving" && arrivedPhase == null) {
      setArrivedPhase("waiting");
      pulseAnim.setValue(1);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [eta, arrivedPhase, pulseAnim]);

  const handleWsMessage = useCallback((data) => {
    if (data.type === "vehicle_update") {
      const lat = data.lat;
      const lng = data.lng || data.lon;
      if (lat && lng) {
        setDriverPos({ latitude: lat, longitude: lng });
      }
      if (data.distance_km != null) {
        setDistance(data.distance_km <= 1 ? `${Math.round(data.distance_km * 1000)} m` : `${data.distance_km} km`);
      }
      if (data.duration_min != null) {
        setEta(data.duration_min <= 1 ? "Arriving" : `${data.duration_min} min`);
      }
    }
    if (data.status === "active" || data.type === "trip_started") {
      goToRideStats();
    }
    if (data.status === "cancelled") {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      navigation.navigate("PassengerTabs");
    }
    if (data.status === "completed" || data.type === "trip_completed") {
      goToRideStats();
    }
  }, [navigation, goToRideStats]);

  useWebSocket(dispatchId ? WS.dispatch(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleWsMessage,
  });

  // Separate tracking WS for live vehicle location/speed/ETA updates
  const handleTrackingMessage = useCallback((data) => {
    if (data.type === "vehicle_update") {
      const lat = data.lat;
      const lng = data.lng || data.lon;
      if (lat && lng) setDriverPos({ latitude: lat, longitude: lng });
      if (data.remaining_distance_km != null) {
        setDistance(data.remaining_distance_km <= 1 ? `${Math.round(data.remaining_distance_km * 1000)} m` : `${data.remaining_distance_km} km`);
      }
      if (data.remaining_duration_min != null) {
        setEta(data.remaining_duration_min <= 1 ? "Arriving" : `${data.remaining_duration_min} min`);
      }
    }
    if (data.type === "trip_completed" || data.status === "completed") {
      goToRideStats();
    }
  }, [goToRideStats]);

  useWebSocket(dispatchId ? WS.trackingTrip(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleTrackingMessage,
  });

  useEffect(() => {
    if (driverPos && passengerPos && mapRef.current) {
      const minLng = Math.min(driverPos.longitude, passengerPos.longitude);
      const maxLng = Math.max(driverPos.longitude, passengerPos.longitude);
      const minLat = Math.min(driverPos.latitude, passengerPos.latitude);
      const maxLat = Math.max(driverPos.latitude, passengerPos.latitude);
      mapRef.current.fitBounds([minLng, minLat, maxLng, maxLat], 80, 800);
    }
  }, [driverPos, passengerPos]);

  useEffect(() => {
    const loadRoute = async () => {
      if (!routeId) return;
      try {
        const data = await fetchRouteGeometry(routeId);
        if (data?.path) setRoutePath(data.path.coordinates || data.path);
      } catch (e) {
        console.warn("Failed to load route geometry", e);
      }
    };
    loadRoute();
  }, [routeId]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleRecenter = () => {
    if (cameraRef.current && passengerPos) {
      cameraRef.current.setStop({
        center: [passengerPos.longitude, passengerPos.latitude],
        zoom: 16,
        duration: 800,
      });
    }
  };

  const handleCancel = async () => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    setShowCancelConfirm(false);
    if (dispatchId) {
      try {
        await dispatch(cancelDispatch(dispatchId)).unwrap();
      } catch (e) {
        console.warn("cancelDispatch failed:", e);
      }
    }
    navigation.reset({ index: 0, routes: [{ name: "PassengerTabs" }] });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapArea}>
        {!mapCenter ? (
          <View style={styles.gpsLoading}>
            <Text style={styles.gpsLoadingText}>Getting your location...</Text>
          </View>
        ) : (
        <VayyMap
          style={styles.mapBg}
          ref={mapRef}
          cameraRef={cameraRef}
          initialViewState={{
            center: [mapCenter.longitude, mapCenter.latitude],
            zoom: 14,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
        >
          <UserLocation visible={true} showsUserHeadingIndicator={true} />
          {passengerPos && (
            <Marker lngLat={[passengerPos.longitude, passengerPos.latitude]}>
              <Image source={require("../../../assets/VayyUserTop.png")} style={styles.userMarker} resizeMode="contain" />
            </Marker>
          )}
          {driverPos && (
            <SmoothMarker id="driver" targetLat={driverPos.latitude} targetLng={driverPos.longitude}>
              <View style={styles.driverMarker}>
                <Text style={{ fontSize: 24 }}>🏍️</Text>
              </View>
            </SmoothMarker>
          )}
          {routePath && (
            <GeoJSONSource
              id="routeSource"
              data={{
                type: "Feature",
                geometry: { type: "LineString", coordinates: routePath },
              }}
            >
              <Layer
                id="routeLayer"
                type="line"
                paint={{
                  "line-color": "#009849",
                  "line-width": 5,
                  "line-join": "round",
                  "line-cap": "round",
                }}
              />
            </GeoJSONSource>
          )}
        </VayyMap>
        )}

        <View style={[styles.header, { paddingTop: insets.top + 10, overflow: "hidden" }]}>
          <View style={styles.headerGradient}>
            <View style={styles.gradBase} />
            <View style={styles.gradRay1} />
            <View style={styles.gradRay2} />
          </View>
          <View style={styles.headerLeft}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#111827" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Ride Accepted!</Text>
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCancelConfirm(true)}>
            <Text style={styles.cancelText}>Cancel</Text>
            <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.recenterBtn, { bottom: 140 }]} onPress={zoomIn}>
          <Ionicons name="add" size={22} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.recenterBtn, { bottom: 86 }]} onPress={zoomOut}>
          <Ionicons name="remove" size={22} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.recenterBtn, { bottom: 32 }]} onPress={handleRecenter}>
          <MaterialIcons name="my-location" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        <View style={styles.acceptedBanner}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={20} color="#009849" />
          </View>
          <View style={styles.acceptedInfo}>
            <Text style={styles.acceptedTitle}>Ride Accepted!</Text>
            <Text style={styles.acceptedSubtitle}>Your Marshal is on the way to you</Text>
          </View>
          <Text style={styles.timestamp}>Just now</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{driverName.charAt(0)}</Text>
            <View style={styles.badge}>
              <Ionicons name="star" size={10} color="#FFB800" />
              <Text style={styles.ratingText}>{driverRating || "—"}</Text>
            </View>
          </View>
          <View style={styles.driverDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.driverName}>{driverName}</Text>
              <MaterialIcons name="verified" size={16} color="#009849" />
            </View>
            <Text style={styles.vehicleInfo}>{vehicle}</Text>
          </View>
          <TouchableOpacity style={styles.callBtn}>
            <Ionicons name="call" size={22} color="#009849" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.otpContainer}>
          <View>
            <Text style={styles.otpLabel}>Handshake OTP</Text>
            <Text style={styles.otpSub}>Share with Marshal to start ride</Text>
          </View>
          <View style={styles.otpRow}>
            {otpDigits.map((d, i) => (
              <View key={i} style={styles.otpBox}>
                <Text style={styles.otpDigit}>{d}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.arrivalNote}>
          <Text style={styles.arrivalNoteText}>
            {eta === "Arriving"
              ? "Your Marshal has arrived. Share OTP to start ride."
              : `Your Marshal is ${distance} away • Arriving in ${eta}`}
          </Text>
        </View>
      </View>

      <Modal visible={arrivedPhase != null} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.arrivedOverlay}>
          <View style={styles.arrivedCard}>
            {arrivedPhase === "waiting" ? (
              <>
                <View style={styles.waitingIconWrap}>
                  <Animated.View style={[styles.pulseRing, { opacity: pulseAnim }]} />
                  <View style={styles.waitingIconInner}>
                    <Image source={require("../../../assets/vayyFrontBike.png")} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  </View>
                </View>
                <Text style={styles.arrivedTitle}>Your Marshal Has Arrived</Text>

                <View style={[styles.driverRow, { marginBottom: 24 }]}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitial}>{driverName.charAt(0)}</Text>
                  </View>
                  <View style={styles.driverDetails}>
                    <Text style={styles.driverName}>{driverName}</Text>
                    <Text style={styles.vehicleInfo}>{vehicle}</Text>
                  </View>
                </View>

                <Text style={styles.arrivedOtpLabel}>Share this OTP with your Marshal</Text>
                <View style={styles.arrivedOtpRow}>
                  {otpDigits.map((d, i) => (
                    <View key={i} style={styles.arrivedOtpBox}>
                      <Text style={styles.arrivedOtpDigit}>{d}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.waitingRow}>
                  <Animated.View style={[styles.waitingDot, { opacity: pulseAnim }]} />
                  <Text style={styles.arrivedWaitText}>Waiting for OTP verification...</Text>
                </View>

                <TouchableOpacity style={styles.arrivedCallBtn} activeOpacity={0.7}>
                  <Ionicons name="call" size={20} color="#009849" />
                  <Text style={styles.arrivedCallText}>Call Marshal</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Animated.View style={[styles.verifiedCircle, { transform: [{ scale: checkScale }] }]}>
                  <Ionicons name="checkmark" size={48} color="#FFFFFF" />
                </Animated.View>
                <Text style={styles.verifiedTitle}>OTP Verified!</Text>
                <Text style={styles.verifiedSub}>Starting your ride...</Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      <ConfirmPopup
        visible={showCancelConfirm}
        title="Cancel Ride?"
        message={`Your ride with ${driverName} will be cancelled.`}
        confirmLabel="Yes, Cancel"
        confirmColor="#EF4444"
        icon="close-circle-outline"
        onConfirm={handleCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", backgroundColor: "#F8FAF9" },
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingBottom: 12, overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradBase: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#009849",
  },
  gradRay1: {
    position: "absolute",
    top: -60,
    right: -40,
    width: "70%",
    height: "90%",
    backgroundColor: "#00B857",
    opacity: 0.25,
    borderRadius: 120,
    transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute",
    top: -80,
    right: -20,
    width: "50%",
    height: "70%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100,
    transform: [{ rotate: "35deg" }],
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5 },
  iconBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "#FFFFFF",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF2F2", paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "#FEE2E2",
  },
  cancelText: { color: "#EF4444", fontSize: 13, fontWeight: "700" },
  mapArea: { flex: 1, backgroundColor: "#F9FAFB" },
  mapBg: { ...StyleSheet.absoluteFillObject },
  gpsLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  gpsLoadingText: { fontSize: 15, fontWeight: "600", color: "#6B7280" },
  driverMarker: { alignItems: "center", justifyContent: "center" },
  userMarker: { width: 35, height: 35 },
  recenterBtn: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 12,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 15,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB",
    alignSelf: "center", marginBottom: 20,
  },
  acceptedBanner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0FAF2',
    justifyContent: 'center', alignItems: 'center',
  },
  acceptedInfo: { flex: 1 },
  acceptedTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  acceptedSubtitle: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  timestamp: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 18 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: '#009849' },
  badge: {
    position: 'absolute', bottom: -4, backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6',
  },
  ratingText: { fontSize: 10, fontWeight: '800', marginLeft: 2 },
  driverDetails: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  vehicleInfo: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  callBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0FAF2',
    justifyContent: 'center', alignItems: 'center',
  },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  otpLabel: { fontSize: 14, fontWeight: '800', color: '#111827' },
  otpSub: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  otpRow: { flexDirection: 'row', gap: 8 },
  otpBox: {
    width: 38, height: 42, borderRadius: 8, backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center',
  },
  otpDigit: { fontSize: 18, fontWeight: '800', color: '#009849' },
  arrivalNote: {
    backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  arrivalNoteText: { fontSize: 13, color: '#4B5563', fontWeight: '700' },
  arrivedOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center",
    alignItems: "center", paddingHorizontal: 24,
  },
  arrivedCard: {
    width: "100%", maxWidth: 360, backgroundColor: "#FFFFFF", borderRadius: 28,
    padding: 28, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 30, elevation: 25,
  },
  waitingIconWrap: {
    width: 88, height: 88, borderRadius: 44, justifyContent: "center",
    alignItems: "center", marginBottom: 16,
  },
  pulseRing: {
    position: "absolute", width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(0,152,73,0.15)",
  },
  waitingIconInner: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#F0FAF2",
    justifyContent: "center", alignItems: "center",
  },
  arrivedTitle: {
    fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 24,
    textAlign: "center",
  },
  arrivedOtpLabel: {
    fontSize: 14, fontWeight: "700", color: "#6B7280", marginBottom: 12,
  },
  arrivedOtpRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  arrivedOtpBox: {
    width: 52, height: 56, borderRadius: 12, backgroundColor: "#F0FAF2",
    borderWidth: 2, borderColor: "#D1FAE5", justifyContent: "center", alignItems: "center",
  },
  arrivedOtpDigit: { fontSize: 24, fontWeight: "800", color: "#009849" },
  waitingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  waitingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#009849" },
  arrivedWaitText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  verifiedCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#009849",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
    shadowColor: "#009849", shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  verifiedTitle: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 4 },
  verifiedSub: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  arrivedCallBtn: {
    width: "100%", height: 52, borderRadius: 18, backgroundColor: "#F0FAF2",
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: "#D1FAE5",
  },
  arrivedCallText: { fontSize: 16, fontWeight: "700", color: "#009849" },
});
