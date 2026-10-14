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
import { completeDispatch } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import useDriverLocationPush from "../hooks/useDriverLocationPush";
import { WS, OPERATIONS } from "../../constants";
import api from "../../shared/lib/api";
import COLORS from "../../shared/constants/colors";
import VayyMap, { UserLocation, Marker, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import ZoomControls from "../../shared/components/common/ZoomControls";
import { fetchRouteGeometry, getRoadDistance } from "../../routes/services/routeService";

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

function splitRouteAtPosition(coords, pos) {
  if (!coords || coords.length < 2) return { covered: [], remaining: coords || [] };
  let minDist = Infinity;
  let nearestIdx = 0;
  let nearestT = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const dist = distanceToSegment(pos.longitude, pos.latitude, lng1, lat1, lng2, lat2);
    if (dist < minDist) {
      minDist = dist;
      nearestIdx = i;
      const dx = lng2 - lng1;
      const dy = lat2 - lat1;
      const len2 = dx * dx + dy * dy;
      nearestT = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pos.longitude - lng1) * dx + (pos.latitude - lat1) * dy) / len2));
    }
  }
  const splitPoint = [
    coords[nearestIdx][0] + nearestT * (coords[nearestIdx + 1][0] - coords[nearestIdx][0]),
    coords[nearestIdx][1] + nearestT * (coords[nearestIdx + 1][1] - coords[nearestIdx][1]),
  ];
  return {
    covered: [...coords.slice(0, nearestIdx + 1), splitPoint],
    remaining: [splitPoint, ...coords.slice(nearestIdx + 1)],
  };
}

function routeBearingFromPosition(coords, pos) {
  if (!coords || coords.length < 2) return null;
  let minDist = Infinity;
  let nearestIdx = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const dist = distanceToSegment(pos.longitude, pos.latitude, lng1, lat1, lng2, lat2);
    if (dist < minDist) { minDist = dist; nearestIdx = i; }
  }
  const nextIdx = Math.min(nearestIdx + 1, coords.length - 1);
  const [lng1, lat1] = coords[nearestIdx];
  const [lng2, lat2] = coords[nextIdx];
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
            Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export default function BikeRideToDestinationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatchRedux = useDispatch();
  const buddy = route.params?.buddy;
  const dispatchId = route.params?.dispatchId || buddy?.dispatchId;
  const dropLat = Number(buddy?.dropLat) || null;
  const dropLng = Number(buddy?.dropLng) || null;
  const routeId = buddy?.route_id || null;
  const mapRef = useRef(null);
  const [destCoords, setDestCoords] = useState(null);
  const destCoordsRef = useRef(null);
  const [distance, setDistance] = useState(null);
  const [eta, setEta] = useState("—");
  const vehicleIdRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [driverPos, setDriverPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [routePath, setRoutePath] = useState(null);
  const [coveredPath, setCoveredPath] = useState(null);
  const [remainingPath, setRemainingPath] = useState(null);
  const [routeBearing, setRouteBearing] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [vehicleReady, setVehicleReady] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showEarlyEndWarning, setShowEarlyEndWarning] = useState(false);
  const startTime = useRef(Date.now());
  const dotAnim = useRef(new Animated.Value(0)).current;
  const totalDistanceRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const res = await api.get(OPERATIONS.vehiclesMe);
        vehicleIdRef.current = res?.data?.data?.id || res?.data?.id || res?.id;
        setVehicleReady(true);
      } catch {}
      let destLat = dropLat;
      let destLng = dropLng;
      if (!destLat || !destLng) {
        try {
          const data = routeId ? await fetchRouteGeometry(routeId) : null;
          if (data?.path) setRoutePath(data.path.coordinates || data.path);
          if (data?.stops?.length) {
            const last = data.stops[data.stops.length - 1];
            const c = last.location?.coordinates || last.location;
            destLat = c[1]; destLng = c[0];
          } else if (data?.path?.coordinates?.length) {
            const c = data.path.coordinates[data.path.coordinates.length - 1];
            destLat = c[1]; destLng = c[0];
          }
        } catch (e) {
          console.warn("Failed to resolve destination from route", e);
        }
      }
      const dest = (destLat && destLng) ? { lat: destLat, lng: destLng } : null;
      if (dest) { setDestCoords(dest); destCoordsRef.current = dest; }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || stopped) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (stopped) return;
      const { latitude, longitude } = pos.coords;
      setDriverPos({ latitude, longitude });
      setMapCenter({ latitude, longitude });
      if (dest) {
        getRoadDistance(latitude, longitude, dest.lat, dest.lng).then((data) => {
          if (stopped) return;
          const d = data.distance_km;
          setDistance(d);
          totalDistanceRef.current = d;
          setEta(data.duration_min <= 1 ? "Arriving" : `${data.duration_min} min`);
        }).catch(() => {});
      }
    })();
    const timeInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime.current) / 1000);
      setElapsed(sec);
    }, 1000);
    return () => {
      stopped = true;
      clearInterval(timeInterval);
    };
  }, [dropLat, dropLng, routeId]);

  useEffect(() => {
    if (!driverPos || !destCoordsRef.current) return;
    const { latitude, longitude } = driverPos;
    const d = destCoordsRef.current;
    if (d) {
      getRoadDistance(latitude, longitude, d.lat, d.lng).then((data) => {
        setDistance(data.distance_km);
        setEta(data.duration_min <= 1 ? "Arriving" : `${data.duration_min} min`);
      }).catch(() => {});
    }
  }, [driverPos]);

  useDriverLocationPush({
    enabled: vehicleReady && !!vehicleIdRef.current,
    vehicleId: vehicleIdRef.current,
    tripId: dispatchId,
    onLocation: (loc) => { setDriverPos(loc); setHeading(loc.heading); },
  });

  useEffect(() => {
    if (!routePath || !driverPos) return;
    const { covered, remaining } = splitRouteAtPosition(routePath, driverPos);
    setCoveredPath(covered);
    setRemainingPath(remaining);
    const brg = routeBearingFromPosition(routePath, driverPos);
    if (brg != null) setRouteBearing(brg);
  }, [driverPos, routePath]);

  const cameraBearing = heading > 0 ? heading : (routeBearing || 0);

  useEffect(() => {
    if (!driverPos || !mapRef.current) return;
    mapRef.current.setCamera({
      center: [driverPos.longitude, driverPos.latitude],
      zoom: 17,
      pitch: 60,
      bearing: cameraBearing,
      duration: 1500,
    });
  }, [driverPos, cameraBearing]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0.3, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [dotAnim]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const totalDist = totalDistanceRef.current || 1;
  const progress = distance !== null ? Math.max(0, Math.min(1, (totalDist - distance) / totalDist)) : 0;

  const handleWsMessage = useCallback((data) => {
    if (data.status === "cancelled") {
      navigation.navigate("DriverTabs");
    }
    if (data.status === "completed") {
      const elapsedSec = Math.floor((Date.now() - startTime.current) / 1000);
      const d = destCoordsRef.current;
      navigation.replace("BikeTripComplete", {
        buddy,
        dispatchId,
        tripData: {
          dispatch_id: dispatchId,
          pickup: buddy?.pickup || "Pickup",
          dropoff: buddy?.drop || "Destination",
          pickupLat: buddy?.pickupLat,
          pickupLng: buddy?.pickupLng,
          dropLat: d?.lat || buddy?.dropLat,
          dropLng: d?.lng || buddy?.dropLng,
          distance: totalDistanceRef.current?.toFixed(1) || "—",
          duration: Math.round(elapsedSec / 60) || 1,
          fare: buddy?.fareAmount || 45,
        },
      });
    }
  }, [navigation, buddy, dispatchId]);

  useWebSocket(dispatchId ? WS.dispatch(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleWsMessage,
  });

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleEndRide = () => setShowEndModal(true);

  const confirmArrived = () => {
    setShowEndModal(false);
    finishRide(false);
  };

  const confirmEarlyEnd = () => {
    setShowEndModal(false);
    setShowEarlyEndWarning(false);
    finishRide(true);
  };

  const finishRide = async (earlyEnd) => {
    if (dispatchId) {
      try {
        await dispatchRedux(completeDispatch(dispatchId)).unwrap();
      } catch (e) {
        console.warn("completeDispatch failed:", e);
      }
    }
    const elapsedSec = Math.floor((Date.now() - startTime.current) / 1000);
    const d = destCoordsRef.current;
    navigation.navigate("BikeTripComplete", {
      buddy,
      dispatchId,
      earlyEnd,
      tripData: {
        dispatch_id: dispatchId,
        pickup: buddy?.pickup || "Pickup",
        dropoff: buddy?.drop || "Destination",
        pickupLat: buddy?.pickupLat,
        pickupLng: buddy?.pickupLng,
        dropLat: d?.lat || buddy?.dropLat,
        dropLng: d?.lng || buddy?.dropLng,
        distance: totalDistanceRef.current?.toFixed(1) || "—",
        duration: Math.round(elapsedSec / 60) || 1,
        fare: buddy?.fareAmount || 45,
      },
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        {!mapCenter ? (
          <View style={styles.gpsLoading}>
            <Text style={styles.gpsLoadingText}>Getting your location...</Text>
          </View>
        ) : (
        <VayyMap
          ref={mapRef}
          style={styles.mapBg}
          initialViewState={{
            center: [mapCenter.longitude, mapCenter.latitude],
            zoom: 17,
            pitch: 60,
          }}
          scrollEnabled
          zoomEnabled
        >
          <UserLocation visible={true} showsUserHeadingIndicator={true} />
          {destCoords && (
            <Marker id="destination" lngLat={[destCoords.lng, destCoords.lat]}>
              <View style={styles.destMarker}>
                <Ionicons name="flag" size={16} color="#fff" />
              </View>
            </Marker>
          )}
          {remainingPath && remainingPath.length > 1 && (
            <GeoJSONSource
              id="routeRemaining"
              data={{
                type: "Feature",
                geometry: { type: "LineString", coordinates: remainingPath },
              }}
            >
              <Layer
                id="routeRemainingLayer"
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
          {coveredPath && coveredPath.length > 1 && (
            <GeoJSONSource
              id="routeCovered"
              data={{
                type: "Feature",
                geometry: { type: "LineString", coordinates: coveredPath },
              }}
            >
              <Layer
                id="routeCoveredLayer"
                type="line"
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                }}
                paint={{
                  "line-color": "#D1D5DB",
                  "line-width": 3,
                  "line-opacity": 0.5,
                }}
              />
            </GeoJSONSource>
          )}
        </VayyMap>
        )}

        <ScreenHeader
          absolute
          zIndex={20}
          title="On Ride"
          subtitle="Drive the passenger to the destination"
          onBack={() => navigation.goBack()}
        />
      </View>

      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.rideCheckSpacer} />
        <Text style={styles.rideCheckLabel}>Ride Check</Text>

        <View style={styles.handle} />

        <View style={styles.buddySection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buddy?.avatar || "RK"}</Text>
          </View>
          <View style={styles.buddyInfo}>
            <Text style={styles.buddyName}>{buddy?.name || "Passenger"}</Text>
            <Text style={styles.destLabel}>
              Drop: <Text style={{ fontWeight: "700", color: "#111827" }}>{buddy?.drop || "Destination"}</Text>
            </Text>
          </View>
          <View style={styles.etaBadge}>
            <Ionicons name="time" size={13} color="#fff" />
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={16} color={COLORS.primary} />
            <Text style={styles.statValue}>{distance != null ? distance.toFixed(1) : "—"} km</Text>
            <Text style={styles.statLabel}>remaining</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="timer" size={16} color="#F59E0B" />
            <Text style={styles.statValue}>{formatTime(elapsed)}</Text>
            <Text style={styles.statLabel}>elapsed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="speedometer" size={16} color="#3B82F6" />
            <Text style={styles.statValue}>{elapsed > 0 && totalDist > 0 && distance != null ? Math.round(((totalDist - distance) / (elapsed / 3600)) || 0) : "—"}</Text>
            <Text style={styles.statLabel}>km/h avg</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.progressThumb, { left: `${progress * 100}%` }]}>
            <Animated.View style={[styles.progressCore, { opacity: dotAnim }]} />
          </View>
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>{buddy?.pickup || "Start"}</Text>
          <Text style={[styles.progressLabel, { color: "#EF4444" }]}>{buddy?.drop || "Drop"}</Text>
        </View>

        <TouchableOpacity style={styles.endRideBtn} onPress={handleEndRide} activeOpacity={0.85}>
          <Ionicons name="stop-circle" size={20} color="#fff" />
          <Text style={styles.endRideText}>End Ride</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showEndModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="flag" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>End Ride</Text>
            <Text style={styles.modalSub}>Have you reached the destination?</Text>

            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={confirmArrived} activeOpacity={0.9}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.modalPrimaryBtnText}>  Arrived at Destination</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => { setShowEndModal(false); setShowEarlyEndWarning(true); }} activeOpacity={0.8}>
              <Ionicons name="warning-outline" size={20} color="#EF4444" />
              <Text style={styles.modalSecondaryBtnText}>  End Ride Early</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEndModal(false)} activeOpacity={0.7}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEarlyEndWarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconWrap, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="warning" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>End Ride Early?</Text>
            <Text style={styles.modalSub}>You haven&apos;t reached the destination yet. The passenger may not be charged the full fuel share and your rating could be affected.</Text>

            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: "#EF4444" }]} onPress={confirmEarlyEnd} activeOpacity={0.9}>
              <Ionicons name="stop-circle" size={20} color="#fff" />
              <Text style={styles.modalPrimaryBtnText}>  End Anyway</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEarlyEndWarning(false)} activeOpacity={0.7}>
              <Text style={styles.modalCancelBtnText}>Continue Ride</Text>
            </TouchableOpacity>
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
  gpsLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  gpsLoadingText: { fontSize: 15, fontWeight: "600", color: "#6B7280" },
  mapArea: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  destMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
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
    boxShadow: "0 -4 20 rgba(0, 0, 0, 0.08)",
  },
  rideCheckSpacer: {
    height: 8,
  },
  rideCheckLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
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
  buddySection: {
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
  destLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 2,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "visible",
    marginBottom: 4,
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  progressThumb: {
    position: "absolute",
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1 4 rgba(0, 0, 0, 0.12)",
    marginLeft: -8,
  },
  progressCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  endRideBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    borderRadius: 18,
    height: 56,
    boxShadow: "0 4 10 rgba(239, 68, 68, 0.3)",
  },
  endRideText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },

  /* modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    height: 52,
    width: "100%",
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  modalSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    height: 52,
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    marginBottom: 10,
  },
  modalSecondaryBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#EF4444",
  },
  modalCancelBtn: {
    paddingVertical: 10,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
  },
});
