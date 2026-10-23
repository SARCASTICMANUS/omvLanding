import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Alert,
} from "react-native";
import VayyMap, { UserLocation, Marker, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import * as Location from "expo-location";
import { fetchRouteGeometry } from "../../routes/services/routeService";
import { cancelBoardingRequest } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import { ConfirmPopup } from "./ConfirmPopup";
import SmoothMarker from "../../shared/components/common/SmoothMarker";
import { formatDistance } from "../../shared/utils/walkingDistance";

const BIKE_TOP_IMAGE = require("../../../assets/vayyTopBike1.webp");

export function RiderPopupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const driverName = route?.params?.driverName || "Driver";
  const vehicle = route?.params?.vehicle || "";
  const dispatchId = route?.params?.dispatchId;
  const boardingRequestId = route?.params?.boardingRequestId || route?.params?.tripData?.boarding_request_id || null;
  const tripData = useMemo(() => route?.params?.tripData || {}, [route?.params?.tripData]);
  const destination = route?.params?.destination || "Destination";
  const pickupName = route?.params?.pickupName || route?.params?.pickup?.name || route?.params?.pickup?.display_name || (typeof route?.params?.pickup === "string" ? route.params.pickup : null) || tripData.pickup_stop?.name || "pickup stop";
  const routeId = route?.params?.route_id;
  const fare = route?.params?.fare || "—";
  const driverRating = route?.params?.driverRating || route?.params?.tripData?.driver_rating || null;
  const rawOtp = route?.params?.otp;
  const otpDigits = rawOtp && rawOtp !== "—" ? String(rawOtp).split("") : ["", "", "", ""];

  const [routePath, setRoutePath] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellingRide, setCancellingRide] = useState(false);
  const [driverPos, setDriverPos] = useState(null);
  const [driverHeading, setDriverHeading] = useState(null);
  const [driverSpeed, setDriverSpeed] = useState(null);
  const [passengerPos, setPassengerPos] = useState(null);
  const [distance, setDistance] = useState(route?.params?.distance || "—");
  const [eta, setEta] = useState(route?.params?.eta || "—");
  const [mapCenter, setMapCenter] = useState(null);
  const navigatingRef = useRef(false);
  const [arrivedPhase, setArrivedPhase] = useState(null);
  const pickupWalkDistanceMeters = route?.params?.pickupWalkDistanceMeters ?? null;
  const cancelInProgressRef = useRef(false);

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (navigatingRef.current) return;
    event.preventDefault();
    setShowCancelConfirm(true);
  }), [navigation]);

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
      boardingRequestId,
      tripData: {
        ...(route?.params?.tripData || {}),
        pickupLat: route?.params?.pickupLat ?? null,
        pickupLng: route?.params?.pickupLng ?? null,
        dropLat: route?.params?.dropLat ?? null,
        dropLng: route?.params?.dropLng ?? null,
        drop_name: route?.params?.dropName || route?.params?.tripData?.drop_name || destination,
      },
    };
    navigation.navigate("RideStats", params);
  }, [navigation, driverName, vehicle, dispatchId, destination, eta, distance, fare, routeId, boardingRequestId, route?.params?.pickupLat, route?.params?.pickupLng, route?.params?.dropLat, route?.params?.dropLng, route?.params?.dropName, route?.params?.tripData]);

  useEffect(() => {
    if (eta === "Arriving" && arrivedPhase == null) {
      setArrivedPhase("waiting");
    }
  }, [eta, arrivedPhase]);

  const handleWsMessage = useCallback((data) => {
    if (data.type === "boarding_request_cancelled") {
      if (data.boarding_request_id !== boardingRequestId) return;
      navigatingRef.current = true;
      navigation.reset({ index: 0, routes: [{ name: "PassengerTabs" }] });
      return;
    }
    if (data.type === "vehicle_update") {
      const lat = data.lat;
      const lng = data.lng || data.lon;
      if (lat && lng) {
        setDriverPos({ latitude: lat, longitude: lng });
      }
      if (data.speed != null) setDriverSpeed(Number(data.speed));
      if (data.heading != null) setDriverHeading(Number(data.heading));
      if (data.distance_km != null) {
        setDistance(data.distance_km <= 1 ? `${Math.round(data.distance_km * 1000)} m` : `${data.distance_km} km`);
      }
      if (data.duration_min != null) {
        setEta(data.duration_min <= 1 ? "Arriving" : `${data.duration_min} min`);
      }
    }
    if (data.status === "arrived") {
      if (data.boarding_request_id && data.boarding_request_id !== boardingRequestId) return;
      setArrivedPhase("waiting");
    }
    if (data.status === "active" || data.type === "trip_started") {
      goToRideStats();
    }
    if (data.status === "cancelled") {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      navigation.navigate("PassengerTabs");
    }
    if (data.type === "passenger_segment_completed") {
      if (data.boarding_request_id !== boardingRequestId) return;
      navigatingRef.current = true;
      navigation.navigate("RideComplete", {
        tripId: dispatchId,
        boardingRequestId,
        riderName: driverName,
        vehicleText: vehicle,
        pickup: tripData.pickup_stop?.name || tripData.pickup || "Pickup Stop",
        dropoff: tripData.dropoff_stop?.name || tripData.dropoff || destination,
        fare: data.fare ?? null,
        distance: data.segment_distance_m != null ? data.segment_distance_m / 1000 : null,
        duration: data.segment_duration_s != null ? data.segment_duration_s / 60 : null,
        driverRating: 0,
        paymentMethod: "Fuel Share",
        route_id: routeId,
      });
      return;
    }
    if (data.status === "completed" || data.type === "trip_completed") goToRideStats();
  }, [navigation, goToRideStats, boardingRequestId, dispatchId, driverName, vehicle, tripData, destination, routeId]);

  useWebSocket(dispatchId ? WS.dispatch(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleWsMessage,
  });

  // Separate tracking WS for live vehicle location/speed/ETA updates
  const handleTrackingMessage = useCallback((data) => {
    if (data.type === "trip_completed") {
      if (data.cancelled) {
        navigatingRef.current = true;
        navigation.navigate("PassengerTabs");
        return;
      }
      const own = (data.passengers || []).find((item) => item.boarding_request_id === boardingRequestId);
      if (own && boardingRequestId) {
        navigatingRef.current = true;
        navigation.navigate("RideComplete", {
          tripId: dispatchId, boardingRequestId, riderName: driverName, vehicleText: vehicle,
          pickup: own.pickup_stop_name || tripData.pickup_stop?.name || tripData.pickup || "Pickup Stop",
          dropoff: own.drop_stop_name || tripData.dropoff_stop?.name || tripData.dropoff || destination,
          fare: own.fare ?? null,
          distance: own.segment_distance_m != null ? own.segment_distance_m / 1000 : null,
          duration: own.segment_duration_s != null ? own.segment_duration_s / 60 : null,
          driverRating: 0, paymentMethod: "Fuel Share", route_id: routeId,
        });
      }
      return;
    }
    if (data.type === "vehicle_update") {
      const lat = data.lat;
      const lng = data.lng || data.lon;
      if (lat && lng) setDriverPos({ latitude: lat, longitude: lng });
      if (data.speed != null) setDriverSpeed(Number(data.speed));
      if (data.heading != null) setDriverHeading(Number(data.heading));
      if (data.pickup_distance_km != null) {
        setDistance(data.pickup_distance_km <= 1 ? `${Math.round(data.pickup_distance_km * 1000)} m` : `${data.pickup_distance_km} km`);
      } else if (data.remaining_distance_km != null) {
        setDistance(data.remaining_distance_km <= 1 ? `${Math.round(data.remaining_distance_km * 1000)} m` : `${data.remaining_distance_km} km`);
      }
      if (data.pickup_duration_min != null) {
        setEta(data.pickup_duration_min <= 1 ? "Arriving" : `${data.pickup_duration_min} min`);
      } else if (data.remaining_duration_min != null) {
        setEta(data.remaining_duration_min <= 1 ? "Arriving" : `${data.remaining_duration_min} min`);
      }
    }
    if (data.type === "trip_completed" || data.status === "completed") {
      goToRideStats();
    }
  }, [goToRideStats, navigation, boardingRequestId, dispatchId, driverName, vehicle, tripData, destination, routeId]);

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
    if (navigatingRef.current || cancelInProgressRef.current) return;
    if (!boardingRequestId) {
      Alert.alert("Unable to cancel ride", "Your ride request details are missing. Please contact support before leaving this screen.");
      return;
    }
    cancelInProgressRef.current = true;
    setCancellingRide(true);
    try {
      await dispatch(cancelBoardingRequest(boardingRequestId)).unwrap();
    } catch (error) {
      console.warn("cancelBoardingRequest failed:", error);
      Alert.alert("Ride not cancelled", "Please try again. Your Marshal may still be on the way.");
      return;
    } finally {
      cancelInProgressRef.current = false;
      setCancellingRide(false);
    }
    navigatingRef.current = true;
    setShowCancelConfirm(false);
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
          grayscale
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
              <Image source={require("../../../assets/VayyUserTop.webp")} style={styles.userMarker} resizeMode="contain" />
            </Marker>
          )}
          {driverPos && (
            <SmoothMarker id="driver" targetLat={driverPos.latitude} targetLng={driverPos.longitude} heading={driverHeading} speedKmh={driverSpeed}>
              <View style={styles.driverMarker}>
                <Image source={BIKE_TOP_IMAGE} style={{ width: 40, height: 46 }} resizeMode="contain" />
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
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                }}
                paint={{
                  "line-color": "#009849",
                  "line-width": 5,
                }}
              />
            </GeoJSONSource>
          )}
        </VayyMap>
        )}

        <ScreenHeader
          absolute
          zIndex={20}
          title="Ride Accepted!"
          subtitle="Your Marshal is on the way to the pickup stop"
          onBack={() => setShowCancelConfirm(true)}
          right={
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowCancelConfirm(true)}
              accessibilityRole="button"
              accessibilityLabel="Cancel ride request"
            >
              <Text style={styles.cancelText}>Cancel</Text>
              <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          }
        />

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
            <Text style={styles.acceptedTitle}>
              {arrivedPhase === "waiting" ? "Your Marshal Has Arrived" : "Ride Accepted!"}
            </Text>
            <Text style={styles.acceptedSubtitle}>
              {arrivedPhase === "waiting"
                ? "Your Marshal is here. Please get ready."
                : "Your Marshal is heading to your pickup stop"}
            </Text>
          </View>
          <Text style={styles.timestamp}>
            {arrivedPhase === "waiting" ? "Arrived" : "Just now"}
          </Text>
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
            <Text style={styles.otpLabel}>Safety Code</Text>
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
          {arrivedPhase === "waiting" ? (
            <Text style={styles.arrivalNoteText}>
              Your Marshal has arrived. Share the Safety Code below to start the ride.
            </Text>
          ) : (
            <>
              {pickupWalkDistanceMeters != null && (
                <Text style={styles.arrivalNoteText}>
                  Walk to {pickupName}: {formatDistance(pickupWalkDistanceMeters)}
                </Text>
              )}
              <Text style={styles.arrivalNoteText}>
                Marshal is {distance} from the pickup stop • Arriving in {eta}
              </Text>
            </>
          )}
        </View>
      </View>

      <ConfirmPopup
        visible={showCancelConfirm}
        title="Cancel your ride?"
        message={`Your request with ${driverName} will be cancelled, and your Marshal will be notified.`}
        confirmLabel={cancellingRide ? "Cancelling…" : "Cancel Ride"}
        cancelLabel="Keep Ride"
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
});
