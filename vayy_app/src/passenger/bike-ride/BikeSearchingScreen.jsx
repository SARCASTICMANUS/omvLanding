import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  Platform,
  Image,
} from "react-native";
import VayyMap, { ViewAnnotation, UserLocation } from "../../shared/components/VayyMap";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import {
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";

import { NoRideFoundPopup } from "./NoRideFoundPopup";
import { ConfirmPopup } from "./ConfirmPopup";
import {
  requestDispatch,
  cancelDispatch,
  cancelBroadcast,
  setDispatchStatus,
  updateDispatchStatus,
  clearDispatch,
} from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import locationService from "../../shared/lib/locationService";

const USER_TOP_IMAGE = require("../../../assets/VayyUserTop.webp");

export function BikeSearchingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { activeDispatch, status: dispatchStatus } = useSelector((state) => state.dispatch);

  // Animations
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // Local state
  const [showNoRide, setShowNoRide] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [searchStatus, setSearchStatus] = useState("locating");
  const [currentPosition, setCurrentPosition] = useState(null);
  const [activeTripId, setActiveTripId] = useState(null);
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [driversNotified, setDriversNotified] = useState(null);

  // Refs
  const requestIdRef = useRef(null);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const locationReadyRef = useRef(false);
  const searchStartedRef = useRef(false);
  const timeoutRef = useRef(null);
  const didFlyRef = useRef(false);
  const navigatedRiderPopupRef = useRef(false);
  const isMountedRef = useRef(true);

  // Route Parameters Destructuring
  const { route_id, pickup_stop_id, drop_stop_id, pickup, pickupName, destination, fare, trip } = route?.params || {};

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const recenter = () => {
    if (cameraRef.current && currentPosition) {
      cameraRef.current.setStop({
        center: [currentPosition.longitude, currentPosition.latitude],
        zoom: 16,
        duration: 800,
      });
    }
  };

  // Safe Navigation Helper to prevent duplicate pushes to navigation stack
  const navigateToRiderPopup = useCallback((screenParams) => {
    if (navigatedRiderPopupRef.current) return;
    navigatedRiderPopupRef.current = true;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    requestIdRef.current = null;

    if (isMountedRef.current && navigation.isFocused()) {
      navigation.replace("RiderPopup", screenParams);
    }
  }, [navigation]);

  // Mount/Unmount Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    didFlyRef.current = false;
    locationReadyRef.current = false;
    searchStartedRef.current = false;
    navigatedRiderPopupRef.current = false;

    setSearchStatus("locating");
    setShowNoRide(false);
    setShowCancelConfirm(false);
    dispatch(clearDispatch());

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const requestId = requestIdRef.current;
      if (requestId && !navigatedRiderPopupRef.current) {
        dispatch(cancelBroadcast(requestId));
      }
      dispatch(clearDispatch());
    };
  }, [dispatch]);

  // Location Tracking Effect
  useEffect(() => {
    let unsub;
    locationService.startTracking((coords) => {
      if (!isMountedRef.current) return;
      const pos = { latitude: coords.latitude, longitude: coords.longitude };
      setCurrentPosition(pos);

      if (!didFlyRef.current) {
        didFlyRef.current = true;
        if (cameraRef.current) {
          cameraRef.current.setStop({
            center: [coords.longitude, coords.latitude],
            zoom: 16,
            duration: 1200,
          });
        }
        setTimeout(() => {
          if (isMountedRef.current) {
            locationReadyRef.current = true;
            setSearchStatus("searching");
          }
        }, 1400);
      }
    }, { distanceInterval: 10, timeInterval: 5000 });

    unsub = () => locationService.stopTracking();
    return () => { if (unsub) unsub(); };
  }, []);

  // Handle WS Broadcast Messages (Passenger match)
  const handleBroadcastWsMessage = useCallback((data) => {
    if (!isMountedRef.current) return;

    if (data.type === "request_accepted" && data.trip_id) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      dispatch(setDispatchStatus("accepted"));
      setActiveTripId(data.trip_id);
      setSearchStatus("found");

      const pickupStr = typeof pickup === "string" ? pickup : pickup?.name || pickup?.display_name || "Pickup";
      const distMeters = data.distance_km ? Math.round(data.distance_km * 1000) : null;
      const distKm = data.distance_km ? `${data.distance_km} km` : "—";
      const distLabels = distMeters ? [distKm, `${Math.round(distMeters * 0.66)}m`, `${Math.round(distMeters * 0.33)}m`, "Arrived"] : [distKm];
      const etaMin = data.eta || 5;
      const etaLabels = [`${etaMin} min`, `${Math.max(1, Math.round(etaMin * 0.6))} min`, `${Math.max(1, Math.round(etaMin * 0.3))} min`, "0 min"];
      const dropName = data.drop_name
        || (destination && (destination.name || destination.display_name))
        || "Destination";

      const tripData = {
        ...data,
        pickup_name: data.pickup_name || pickupStr,
        drop_name: data.drop_name || dropName,
        pickupLat: data.pickup_lat != null ? Number(data.pickup_lat) : null,
        pickupLng: data.pickup_lng != null ? Number(data.pickup_lng) : null,
        dropLat: data.drop_lat != null ? Number(data.drop_lat) : null,
        dropLng: data.drop_lng != null ? Number(data.drop_lng) : null,
      };

      setTimeout(() => {
        navigateToRiderPopup({
          driverName: data.driver_name || "Driver",
          vehicle: data.vehicle_number || "",
          otp: data.otp || "—",
          distanceLabels: distLabels,
          etaLabels: etaLabels,
          dispatchId: data.trip_id,
          destination: destination || "Destination",
          pickup: pickupStr,
          pickupName: pickupName || pickupStr,
          pickupLat: tripData.pickupLat,
          pickupLng: tripData.pickupLng,
          dropLat: tripData.dropLat,
          dropLng: tripData.dropLng,
          dropName,
          route_name: data.route_name || "",
          eta: String(etaMin),
          distance: distMeters ? String(distMeters) : "—",
          fare: fare || "—",
          route_id,
          tripData,
        });
      }, 600);
    } else if (data.type === "no_drivers_available") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestIdRef.current = null;
      setShowNoRide(true);
      setSearchStatus("failed");
      setActiveRequestId(null);
      setDriversNotified(null);
    }
  }, [dispatch, pickup, destination, pickupName, fare, route_id, navigateToRiderPopup]);

  useWebSocket(activeRequestId ? WS.dispatchBroadcast(activeRequestId) : null, {
    enabled: !!activeRequestId,
    onMessage: handleBroadcastWsMessage,
  });

  // Handle direct WS dispatch Updates
  const handleWsMessage = useCallback((data) => {
    if (!isMountedRef.current) return;

    if (data.status === "accepted" || data.status === "assigned") {
      dispatch(setDispatchStatus("accepted"));
      if (data.driver_name || data.vehicle_number || data.otp) {
        dispatch(updateDispatchStatus({
          driver_name: data.driver_name,
          vehicle_number: data.vehicle_number,
          otp: data.otp,
          fare: data.fare,
          distance: data.distance,
        }));
      }
    } else if (data.status === "rejected" || data.status === "cancelled") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestIdRef.current = null;
      dispatch(setDispatchStatus("failed"));
    }
  }, [dispatch]);

  useWebSocket(activeTripId ? WS.dispatch(activeTripId) : null, {
    enabled: !!activeTripId,
    onMessage: handleWsMessage,
  });

  // Dispatch Request Initiator
  const startSearch = useCallback(async () => {
    if (!locationReadyRef.current || searchStartedRef.current) return;
    searchStartedRef.current = true;
    if (isMountedRef.current) {
      setShowNoRide(false);
      setSearchStatus("searching");
    }

    if (route_id && pickup_stop_id) {
      try {
        const result = await dispatch(requestDispatch({
          route_id,
          pickup_stop_id,
          drop_stop_id,
          mode: "broadcast",
        })).unwrap();

        if (!isMountedRef.current) return;

        const payload = result.data || result;
        if (payload.status === "no_drivers_available") {
          setShowNoRide(true);
          setSearchStatus("failed");
          setDriversNotified(null);
          return;
        }

        const requestId = payload.request_id;
        if (requestId) {
          requestIdRef.current = requestId;
          setActiveRequestId(requestId);
        }
        setDriversNotified(payload.drivers_notified ?? null);
        const tripId = payload.trip_id || payload.id;
        if (tripId) {
          setActiveTripId(tripId);
        }

        // 3 minute timeout fallback
        timeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          requestIdRef.current = null;
          if (requestId) dispatch(cancelBroadcast(requestId));
          setShowNoRide(true);
          setSearchStatus("failed");
          setActiveRequestId(null);
          setActiveTripId(null);
        }, 180000);
      } catch (err) {
        console.warn("Dispatch request failed:", err);
        if (isMountedRef.current) {
          setShowNoRide(true);
          setSearchStatus("failed");
        }
      }
    }
  }, [route_id, pickup_stop_id, drop_stop_id, dispatch]);

  useEffect(() => {
    if (locationReadyRef.current && !searchStartedRef.current) {
      startSearch();
    }
  }, [searchStatus, startSearch]);

  async function handleTryAgain() {
    setShowNoRide(false);
    setSearchStatus("searching");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveTripId(null);
    setActiveRequestId(null);
    requestIdRef.current = null;
    searchStartedRef.current = false;

    await startSearch();
  }

  // Handle Redux state synchronization for accepted or failed dispatch
  useEffect(() => {
    if (dispatchStatus === "accepted" && !navigatedRiderPopupRef.current) {
      setSearchStatus("found");
      const driverData = activeDispatch || {};
      const pickupStr = typeof pickup === "string" ? pickup : pickup?.name || pickup?.display_name || "Pickup";
      const resolvedPickupName = pickupName || pickupStr;
      const rawDist = Number(driverData.distance) || null;
      const rawEta = Number(driverData.eta) || null;
      const fmtDist = (d) => d == null ? "—" : d > 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`;
      const distanceLabels = rawDist != null ? [fmtDist(rawDist), fmtDist(Math.round(rawDist * 0.66)), fmtDist(Math.round(rawDist * 0.33)), "Arrived"] : ["—"];
      const etaLabels = rawEta != null ? [`${rawEta} min`, `${Math.max(1, Math.round(rawEta * 0.6))} min`, `${Math.max(1, Math.round(rawEta * 0.3))} min`, "0 min"] : ["—"];

      const pickupStop = trip?.pickup_stop || {};
      const dropoffStop = trip?.dropoff_stop || {};
      const pickupLat = typeof pickupStop?.lat === "number" ? pickupStop.lat : null;
      const pickupLng = typeof pickupStop?.lon === "number" ? pickupStop.lon : null;
      const dropLat = typeof dropoffStop?.lat === "number" ? dropoffStop.lat : null;
      const dropLng = typeof dropoffStop?.lon === "number" ? dropoffStop.lon : null;
      const dropName = (destination && (destination.name || destination.display_name)) || "Destination";

      const tripData = {
        ...driverData,
        pickup_name: resolvedPickupName,
        drop_name: dropName,
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
      };

      setTimeout(() => {
        navigateToRiderPopup({
          driverName: driverData.driver_name || driverData.driver?.full_name || "Driver",
          vehicle: driverData.vehicle_number || driverData.vehicle?.vehicle_number || "",
          otp: driverData.otp || "—",
          distanceLabels,
          etaLabels,
          dispatchId: driverData.trip_id || driverData.id,
          destination: destination || "Destination",
          pickup: pickupStr,
          pickupName: resolvedPickupName,
          pickupLat,
          pickupLng,
          dropLat,
          dropLng,
          dropName,
          route_name: driverData.route_name || trip?.name || "",
          eta: driverData.eta || "—",
          distance: driverData.distance || "—",
          fare: driverData.fare || fare || "—",
          route_id,
          tripData,
        });
      }, 600);
    }

    if (dispatchStatus === "failed") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setShowNoRide(true);
      setSearchStatus("failed");
    }
  }, [dispatchStatus, activeDispatch, pickup, pickupName, destination, fare, trip, route_id, navigateToRiderPopup]);

  // Wave Animations
  useEffect(() => {
    const makeWave = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const w1 = makeWave(waveAnim1, 0);
    const w2 = makeWave(waveAnim2, 660);
    const w3 = makeWave(waveAnim3, 1320);
    w1.start();
    w2.start();
    w3.start();

    return () => {
      w1.stop();
      w2.stop();
      w3.stop();
    };
  }, [waveAnim1, waveAnim2, waveAnim3]);

  const handleCancelRequest = () => {
    setShowCancelConfirm(false);
    if (activeRequestId) {
      dispatch(cancelBroadcast(activeRequestId));
    } else if (activeTripId) {
      dispatch(cancelDispatch(activeTripId));
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Map Area with Searching Animation */}
      <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          ref={mapRef}
          cameraRef={cameraRef}
          initialViewState={{
            center: currentPosition ? [currentPosition.longitude, currentPosition.latitude] : [80.8, 26.8],
            zoom: 15,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
        >
          <UserLocation />
          {currentPosition && (
            <ViewAnnotation id="user-pulse" lngLat={[currentPosition.longitude, currentPosition.latitude]}>
              <View style={styles.pulseOnMap}>
                <Animated.View
                  style={[
                    styles.waveRing,
                    {
                      transform: [{ scale: waveAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
                      opacity: waveAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.waveRing,
                    {
                      transform: [{ scale: waveAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
                      opacity: waveAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.waveRing,
                    {
                      transform: [{ scale: waveAnim3.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
                      opacity: waveAnim3.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                    },
                  ]}
                />
                <View style={styles.userDot}>
                  <Image source={USER_TOP_IMAGE} style={styles.userDotImage} resizeMode="contain" />
                </View>
              </View>
            </ViewAnnotation>
          )}
        </VayyMap>

        {/* Header */}
        <ScreenHeader
          absolute
          zIndex={20}
          title={searchStatus === "locating" ? "Getting Location..." : "Finding Marshal..."}
          subtitle="Matching you with the nearest Marshal"
          onBack={() => navigation.goBack()}
        />

        {/* Floating Controls */}
        <View style={styles.floatingContainer}>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomIn}>
            <Ionicons name="add" size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomOut}>
            <Ionicons name="remove" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.floatDivider} />
          <TouchableOpacity style={styles.floatBtn} onPress={recenter}>
            <MaterialIcons name="my-location" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        <View style={styles.availabilityRow}>
          <View style={styles.availItem}>
            <Image source={require("../../../assets/vayyFrontBike.webp")} style={{ width: 18, height: 18 }} resizeMode="contain" />
            <Text style={styles.availText}><Text style={styles.availBold}>{driversNotified ?? "—"}</Text> Marshals nearby</Text>
          </View>
          <View style={styles.availDivider} />
          <View style={styles.availItem}>
            <Ionicons name="time-outline" size={18} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>- min</Text> avg. wait</Text>
          </View>
        </View>

        {searchStatus === "locating" && (
          <View style={styles.searchingInfo}>
            <Text style={styles.searchingTitle}>Getting your location...</Text>
            <Text style={styles.searchingSub}>Please wait while we find your position</Text>
          </View>
        )}

        {searchStatus === "searching" && (
          <>
            <View style={styles.searchingInfo}>
              <Text style={styles.searchingTitle}>Searching for nearby Marshals...</Text>
              <Text style={styles.searchingSub}>Your location has been shared with nearby Marshals</Text>
            </View>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.raisedBtn}
              disabled={true}
            >
              <Text style={styles.raisedText}>✋ Hand Raised</Text>
            </TouchableOpacity>
          </>
        )}

        {searchStatus === "found" && (
          <>
            <View style={styles.searchingInfo}>
              <Text style={styles.searchingTitle}>Marshal Found!</Text>
              <Text style={styles.searchingSub}>Connecting you to the nearest Marshal</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.foundBtn}
              onPress={() => {
                const pickupStr = typeof pickup === "string" ? pickup : pickup?.name || pickup?.display_name || "Pickup";
                const driverData = activeDispatch || {};
                const rawDist = Number(driverData.distance) || null;
                const rawEta = Number(driverData.eta) || null;
                const fmtDist = (d) => d == null ? "—" : d > 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`;
                const distLabels = rawDist != null ? [fmtDist(rawDist), fmtDist(Math.round(rawDist * 0.66)), fmtDist(Math.round(rawDist * 0.33)), "Arrived"] : ["—"];
                const etaLbls = rawEta != null ? [`${rawEta} min`, `${Math.max(1, Math.round(rawEta * 0.6))} min`, `${Math.max(1, Math.round(rawEta * 0.3))} min`, "0 min"] : ["—"];

                navigateToRiderPopup({
                  driverName: driverData.driver_name || driverData.driver?.full_name || "Driver",
                  vehicle: driverData.vehicle_number || driverData.vehicle?.vehicle_number || "",
                  otp: driverData.otp || "—",
                  distanceLabels: distLabels,
                  etaLabels: etaLbls,
                  dispatchId: driverData.trip_id || driverData.id || activeTripId,
                  destination: destination || "Destination",
                  pickup: pickupStr,
                  pickupName: pickupName || pickupStr,
                  eta: driverData.eta || "—",
                  distance: driverData.distance || "—",
                  fare: driverData.fare || fare || "—",
                  route_id,
                  tripData: driverData,
                });
              }}
            >
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.foundBtnText}> Marshal Found! Tap to view</Text>
            </TouchableOpacity>
          </>
        )}

        {searchStatus !== "locating" && (
          <TouchableOpacity
            onPress={() => setShowCancelConfirm(true)}
            style={styles.cancelLink}
          >
            <Text style={styles.cancelLinkText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>

      <NoRideFoundPopup
        visible={showNoRide}
        onTryAgain={handleTryAgain}
        onCancel={() => setShowNoRide(false)}
      />

      <ConfirmPopup
        visible={showCancelConfirm}
        title="Cancel Request?"
        message="Your hand raise request will be cancelled and Marshals won't be notified."
        confirmLabel="Yes, Cancel"
        confirmColor="#EF4444"
        icon="close-circle-outline"
        onConfirm={handleCancelRequest}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F8FAF9",
  },
  mapArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F9FAFB",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  pulseOnMap: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  waveRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#009849",
    backgroundColor: "rgba(0, 152, 73, 0.08)",
  },
  userDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  userDotImage: {
    width: 56,
    height: 56,
  },
  floatingContainer: {
    position: "absolute",
    right: 16,
    gap: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
    bottom: 200,
  },
  floatBtn: {
    width: 48,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  floatDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 12,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
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
    marginBottom: 24,
  },
  availabilityRow: {
    flexDirection: "row",
    backgroundColor: "#ECFAF1",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    justifyContent: "center",
    gap: 16,
  },
  availItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  availText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  availBold: {
    fontWeight: "800",
    color: "#009849",
  },
  availDivider: {
    width: 1,
    backgroundColor: "#A7F3C4",
  },
  searchingInfo: {
    alignItems: "center",
    marginBottom: 24,
  },
  searchingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  searchingSub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
  raisedBtn: {
    height: 60,
    borderRadius: 20,
    backgroundColor: "rgba(0, 152, 73, 0.4)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  raisedText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  foundBtn: {
    height: 60,
    borderRadius: 20,
    backgroundColor: "#009849",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#009849",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  foundBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  cancelLink: {
    marginTop: 16,
    alignItems: "center",
  },
  cancelLinkText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "700",
  },
});
