import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Modal,
  Linking,
  Share,
} from "react-native";
import VayyMap, { UserLocation, Marker, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import SmoothMarker from "../../shared/components/common/SmoothMarker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";
import * as Location from "expo-location";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import { useDispatch } from "react-redux";
import { completeDispatch } from "../../store/slices/dispatchSlice";
import { fetchRouteGeometry } from "../../routes/services/routeService";

const DESTINATION_THRESHOLD = 100;

function haversine(a, b) {
  const R = 6371e3;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function RideStatsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatchRedux = useDispatch();
  const [speed, setSpeed] = useState(null);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [passengerPos, setPassengerPos] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [driverHeading, setDriverHeading] = useState(null);
  const [driverSpeed, setDriverSpeed] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const destinationRaw = route?.params?.destination || "Destination";
  const destination = typeof destinationRaw === "string" ? destinationRaw : destinationRaw?.name || destinationRaw?.display_name || "Destination";
  const eta = route?.params?.eta || "—";
  const distanceLeft = route?.params?.distance || "—";
  const driverName = route?.params?.driverName || "Driver";
  const vehicle = route?.params?.vehicle || "";
  const dispatchId = route?.params?.dispatchId || "";
  const fare = route?.params?.fare || "—";
  const tripData = route?.params?.tripData || {};
  const route_id = route?.params?.route_id || "";
  const destLat = tripData?.dropLat ?? tripData?.dropoff_lat ?? route?.params?.dropLat ?? null;
  const destLng = tripData?.dropLng ?? tripData?.dropoff_lng ?? route?.params?.dropLng ?? null;
  const [routePath, setRoutePath] = useState(null);
  const [endRideCase, setEndRideCase] = useState("arrived");
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const navigatingRef = useRef(false);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

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

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleRecenter = () => {
    if (!cameraRef.current) return;
    if (passengerPos) {
      cameraRef.current.setStop({
        center: [passengerPos.longitude, passengerPos.latitude],
        zoom: 15,
        duration: 800,
      });
    } else if (mapCenter) {
      cameraRef.current.setStop({
        center: [mapCenter.longitude, mapCenter.latitude],
        zoom: 15,
        duration: 800,
      });
    }
  };

  const handleWsMessage = useCallback((data) => {
    if (navigatingRef.current) return;
    if (data.status === "cancelled") {
      navigatingRef.current = true;
      navigation.navigate("PassengerTabs");
    }
    if (data.status === "completed" || data?.type === "trip_completed") {
      navigatingRef.current = true;
      const pickupVal = (() => {
        const p = tripData.pickup_stop?.name || tripData.pickup;
        if (!p) return "Pickup Stop";
        return typeof p === "string" ? p : p.name || p.display_name || "Pickup Stop";
      })();
      navigation.navigate("RideComplete", {
        tripId: data.trip_id || dispatchId,
        riderName: driverName,
        vehicleText: vehicle,
        pickup: pickupVal,
        dropoff: destination,
        distance: distanceLeft,
        duration: eta,
        fare: fare,
        driverRating: 0,
        paymentMethod: "Cash",
        route_id,
      });
    }
  }, [dispatchId, driverName, vehicle, tripData, destination, distanceLeft, eta, fare, route_id, navigation]);

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

  // Tracking WS for live distance/ETA from backend
  const handleTrackingMessage = useCallback((data) => {
    if (data.type === "vehicle_update") {
      const lat = data.lat;
      const lng = data.lng || data.lon;
      if (lat && lng) {
        setDriverPos({ latitude: lat, longitude: lng });
      }
      if (data.speed != null) setDriverSpeed(Number(data.speed));
      if (data.heading != null) setDriverHeading(Number(data.heading));
      if (data.remaining_distance_km != null) {
        setRemainingDistance(data.remaining_distance_km * 1000);
      }
    }
  }, []);

  useWebSocket(dispatchId ? WS.trackingTrip(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleTrackingMessage,
  });

  useEffect(() => {
    if (passengerPos && destLat && destLng && mapRef.current) {
      const minLng = Math.min(passengerPos.longitude, destLng);
      const maxLng = Math.max(passengerPos.longitude, destLng);
      const minLat = Math.min(passengerPos.latitude, destLat);
      const maxLat = Math.max(passengerPos.latitude, destLat);
      mapRef.current.fitBounds([minLng, minLat, maxLng, maxLat], 80, 800);
    }
  }, [passengerPos, destLat, destLng]);

  useEffect(() => {
    const loadRoute = async () => {
      if (!route_id) return;
      try {
        const data = await fetchRouteGeometry(route_id);
        if (data?.path) setRoutePath(data.path.coordinates || data.path);
      } catch (e) {
        console.warn("Failed to load route geometry", e);
      }
    };
    loadRoute();
  }, [route_id]);

  function handleEndRideTap() {
    const hasReached = remainingDistance <= DESTINATION_THRESHOLD;
    setEndRideCase(hasReached ? "arrived" : "not_arrived");
    setShowEndConfirm(true);
  }

  async function handleConfirmEndRide() {
    setShowEndConfirm(false);
    const tripId = tripData.trip_id || dispatchId;
    try {
      await dispatchRedux(completeDispatch(tripId)).unwrap();
    } catch (e) {
      console.warn("completeDispatch passenger end ride failed:", e);
    }
    navigation.navigate("RideComplete", {
      tripId,
      riderName: driverName,
      vehicleText: vehicle,
      pickup: (() => {
        const p = tripData.pickup_stop?.name || tripData.pickup;
        if (!p) return "Pickup Stop";
        return typeof p === "string" ? p : p.name || p.display_name || "Pickup Stop";
      })(),
      dropoff: destination,
      distance: distanceLeft,
      duration: eta,
      fare: fare,
      driverRating: 0,
      paymentMethod: "Cash",
      route_id,
    });
  }

  function handleShareTrip() {
    const shareText = [
      `📍 ${driverName} is riding me to ${destination} via VAYY!`,
      `⏱ ETA: ${eta} · 📏 ${distanceLeft}`,
      `🆔 Trip: ${tripData.trip_id || dispatchId}`,
    ].join("\n");
    Share.share({ message: shareText }).catch(() => {});
  }

  function handleEmergency() {
    setShowEmergencyModal(true);
  }

  const destinationLabel = remainingDistance != null
    ? remainingDistance >= 1000
      ? `${(remainingDistance / 1000).toFixed(1)} km`
      : `${remainingDistance} m`
    : "—";

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
          scrollEnabled
          zoomEnabled
        >
          <UserLocation visible={true} showsUserHeadingIndicator={true} />
          {destLat && destLng && (
            <Marker id="destination" lngLat={[destLng, destLat]}>
              <View style={styles.destMarker}>
                <Ionicons name="flag" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          )}
          {driverPos && (
            <SmoothMarker id="driver" targetLat={driverPos.latitude} targetLng={driverPos.longitude} heading={driverHeading} speedKmh={driverSpeed}>
              <View style={styles.driverMarker}>
                <Text style={styles.driverEmoji}>🏍️</Text>
              </View>
            </SmoothMarker>
          )}
          {routePath && (
            <GeoJSONSource
              id="route-path"
              data={{
                type: "Feature",
                geometry: { type: "LineString", coordinates: routePath },
              }}
            >
              <Layer
                id="route-path-layer"
                type="line"
                paint={{
                  "line-color": "#009849",
                  "line-width": 4,
                  "line-opacity": 0.7,
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
            {Platform.OS === "ios" && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#111827" />
              </TouchableOpacity>
            )}
            <View style={styles.statusContainer}>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>Ride Active</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleShareTrip}>
              <Feather name="share" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleEmergency}>
              <MaterialIcons name="emergency" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.distanceCallout}>
          <Text style={styles.distanceCalloutValue}>{destinationLabel}</Text>
          <Text style={styles.distanceCalloutLabel}>to destination</Text>
          <View style={styles.calloutArrow} />
        </View>

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
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="location" size={24} color="#009849" />
            <Text style={styles.statLabel}>Pickup Stop</Text>
            <Text style={styles.statMainBold}>
            {destination}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Ionicons name="time-outline" size={24} color="#009849" />
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValueGreen}>{eta} <Text style={styles.smallUnit}>min</Text></Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Ionicons name="share-social-outline" size={24} color="#009849" />
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValueGreen}>{distanceLeft} <Text style={styles.smallUnit}>m</Text></Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <MaterialCommunityIcons name="speedometer" size={24} color="#009849" />
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValueGreen}>{speed != null ? speed : "—"} {speed != null && <Text style={styles.smallUnit}>km/h</Text>}</Text>
          </View>
        </View>

        <View style={styles.remainingRow}>
          <Ionicons name="location" size={16} color="#009849" />
          <Text style={styles.remainingLabel}>Arriving at destination in</Text>
          <Text style={styles.remainingValue}>{eta} min</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.endRideBtn}
          onPress={handleEndRideTap}
        >
          <Text style={styles.endRideBtnText}>End Ride</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showEndConfirm} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.endOverlay}>
          <View style={styles.endCard}>
            <View style={styles.endIconWrap}>
              <Ionicons
                name={endRideCase === "arrived" ? "flag" : "warning"}
                size={40}
                color={endRideCase === "arrived" ? "#009849" : "#F59E0B"}
              />
            </View>

            {endRideCase === "arrived" ? (
              <>
                <Text style={styles.endTitle}>Looks like you've reached your destination.</Text>
                <Text style={styles.endMessage}>End Ride?</Text>
                <View style={styles.endActions}>
                  <TouchableOpacity style={styles.endPrimaryBtn} onPress={handleConfirmEndRide}>
                    <Text style={styles.endPrimaryText}>End Ride</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.endSecondaryBtn} onPress={() => setShowEndConfirm(false)}>
                    <Text style={styles.endSecondaryText}>Continue Ride</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.endTitle}>You are still {destinationLabel} away from your destination.</Text>
                <Text style={styles.endMessage}>Are you sure you want to end the ride?</Text>
                <View style={styles.endActions}>
                  <TouchableOpacity style={[styles.endPrimaryBtn, styles.endDangerBtn]} onPress={handleConfirmEndRide}>
                    <Text style={styles.endPrimaryText}>End Ride Anyway</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.endSecondaryBtn} onPress={() => setShowEndConfirm(false)}>
                    <Text style={styles.endSecondaryText}>Continue Ride</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>



      <Modal visible={showEmergencyModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.emergencyOverlay}>
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyIconWrap}>
              <MaterialIcons name="emergency" size={48} color="#EF4444" />
            </View>
            <Text style={styles.emergencyTitle}>Emergency</Text>
            <Text style={styles.emergencySub}>Your location will be shared with emergency contacts.</Text>

            <TouchableOpacity
              style={styles.emergencyCallBtn}
              onPress={() => Linking.openURL("tel:112")}
            >
              <Ionicons name="call" size={22} color="#FFFFFF" />
              <Text style={styles.emergencyCallText}>Call 112</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emergencyContactBtn}
              onPress={() => Linking.openURL("tel:112")}
            >
              <Text style={styles.emergencyContactText}>Call Emergency Contact</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emergencyCloseBtn}
              onPress={() => setShowEmergencyModal(false)}
            >
              <Text style={styles.emergencyCloseText}>I'm Safe</Text>
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
    position: "relative",
    backgroundColor: "#F8FAF9",
  },
  gpsLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  gpsLoadingText: { fontSize: 15, fontWeight: "600", color: "#6B7280" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 12,
    overflow: "hidden",
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00E676",
  },
  statusText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  mapArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  destMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  driverMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  driverEmoji: {
    fontSize: 28,
  },
  distanceCallout: {
    position: "absolute",
    bottom: 300,
    left: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#009849",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  distanceCalloutValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#009849",
  },
  distanceCalloutLabel: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
  },
  calloutArrow: {
    position: "absolute",
    bottom: -8,
    left: "30%",
    width: 14,
    height: 14,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "#009849",
    transform: [{ rotate: "45deg" }],
  },
  floatingContainer: {
    position: "absolute",
    right: 16,
    gap: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 6,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
    bottom: 200,
  },
  floatBtn: {
    width: 48, height: 44,
    justifyContent: "center", alignItems: "center",
  },
  floatDivider: {
    height: 1, backgroundColor: "#F0F0F0", marginHorizontal: 12,
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#F3F4F6",
    marginHorizontal: 2,
  },
  statLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  statMainBold: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    color: "#111827",
    lineHeight: 18,
  },
  statValueGreen: {
    fontSize: 20,
    fontWeight: "800",
    color: "#009849",
  },
  smallUnit: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
  },
  remainingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
    marginTop: 8,
  },
  remainingLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  remainingValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#009849",
  },
  endRideBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  endRideBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  endOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  endCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  endIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0FAF2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  endTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  endMessage: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  endActions: {
    width: "100%",
    gap: 10,
  },
  endPrimaryBtn: {
    height: 52,
    borderRadius: 18,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#009849",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  endDangerBtn: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  endPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  endSecondaryBtn: {
    height: 44,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  endSecondaryText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
  emergencyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emergencyCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 25,
  },
  emergencyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emergencyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#EF4444",
    marginBottom: 8,
  },
  emergencySub: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emergencyCallBtn: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#EF4444",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emergencyCallText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  emergencyContactBtn: {
    width: "100%",
    height: 50,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  emergencyContactText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
  },
  emergencyCloseBtn: {
    marginTop: 16,
  },
  emergencyCloseText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
});
