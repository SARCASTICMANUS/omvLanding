import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from "react-native";
import VayyMap, { ViewAnnotation } from "../../shared/components/VayyMap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import {
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import { ConfirmPopup } from "../bike-ride/ConfirmPopup";
import { NoRideFoundPopup } from "../bike-ride/NoRideFoundPopup";
import { fetchActiveRouteTrips, createBoardingRequest, setDispatchStatus } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import { cancelBoardingRequest, getNearbyVehicles } from "../services/passengerService";

// const { width } = Dimensions.get("window");

export function AutoSearchingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { activeDispatch, status: dispatchStatus, boardingRequest } = useSelector((state) => state.dispatch);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const [showNoRide, setShowNoRide] = useState(false);
  const [showBoardConfirm, setShowBoardConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [searchStatus, setSearchStatus] = useState("searching");
  const [handRaised, setHandRaised] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [nearbyCount, setNearbyCount] = useState(null);
  const [activeTripData, setActiveTripData] = useState(null);
  const timerRef = useRef(null);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const didFitRef = useRef(false);

  const { route_id, pickup_stop_id, trip, pickup, destination, boardingRequestId } = route?.params || {};

  const pickupStop = trip?.pickup_stop || {};
  const pickupName = pickupStop?.name || pickup?.name || pickup?.display_name || "the stop";

  const pickupLat = typeof pickupStop?.lat === "number" ? pickupStop.lat : typeof pickupStop?.latitude === "number" ? pickupStop.latitude : null;
  const pickupLon = typeof pickupStop?.lon === "number" ? pickupStop.lon : typeof pickupStop?.longitude === "number" ? pickupStop.longitude : null;

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleRecenter = () => {
    if (pickupLat != null && pickupLon != null) {
      cameraRef.current?.setStop({ center: [pickupLon, pickupLat], zoom: 15, duration: 500 });
    }
  };

  useEffect(() => {
    if (didFitRef.current) return;
    const tryFit = (attempt) => {
      if (didFitRef.current) return;
      if (!cameraRef.current) {
        if (attempt < 10) setTimeout(() => tryFit(attempt + 1), 200);
        return;
      }
      didFitRef.current = true;
      if (pickupLat != null && pickupLon != null) {
        cameraRef.current.setStop({ center: [pickupLon, pickupLat], zoom: 15, duration: 500 });
      }
    };
    tryFit(0);
  }, [pickupLat, pickupLon]);

  const [activeTripId, setActiveTripId] = useState(null);

  const handleWsMessage = useCallback((data) => {
    if (data.type === "trip_update" && data.status === "active") {
      dispatch(setDispatchStatus("accepted"));
    } else if (data.type === "boarding_update" && data.event === "boarded") {
      dispatch(setDispatchStatus("accepted"));
    }
  }, [dispatch]);

  useWebSocket(activeTripId ? WS.trackingTrip(activeTripId) : null, {
    enabled: !!activeTripId,
    onMessage: handleWsMessage,
  });

  const startSearch = useCallback(async () => {
    setShowNoRide(false);
    setSearchStatus("searching");

    if (route_id && pickup_stop_id) {
      try {
        const result = await dispatch(fetchActiveRouteTrips(route_id)).unwrap();
        const trips = result.data || result;
        if (Array.isArray(trips) && trips.length > 0) {
          const activeTrip = trips[0];
          setActiveTripId(activeTrip.trip_id);
          setActiveTripData(activeTrip);
          dispatch(createBoardingRequest({ trip: activeTrip.trip_id, pickup_stop: pickup_stop_id }));
        } else {
          setShowNoRide(true);
          setSearchStatus("failed");
        }
      } catch (err) {
        setShowNoRide(true);
        setSearchStatus("failed");
      }
    } else {
      timerRef.current = setTimeout(() => {
        setShowNoRide(true);
        setSearchStatus("failed");
      }, 4000);
    }
  }, [route_id, pickup_stop_id, dispatch]);

  async function handleTryAgain() {
    setShowNoRide(false);
    setSearchStatus("searching");
    clearTimeout(timerRef.current);

    if (route_id && pickup_stop_id) {
      try {
        const result = await dispatch(fetchActiveRouteTrips(route_id)).unwrap();
        const trips = result.data || result;
        if (Array.isArray(trips) && trips.length > 0) {
          const activeTrip = trips[0];
          setActiveTripId(activeTrip.trip_id);
          dispatch(createBoardingRequest({ trip: activeTrip.trip_id, pickup_stop: pickup_stop_id }));
        } else {
          setShowNoRide(true);
          setSearchStatus("failed");
        }
      } catch (err) {
        setShowNoRide(true);
        setSearchStatus("failed");
      }
    } else {
      timerRef.current = setTimeout(() => {
        setSearchStatus("found");
        setShowBoardConfirm(true);
      }, 4000);
    }
  }

  useEffect(() => {
    if (dispatchStatus === "requested" || dispatchStatus === "accepted") {
      setSearchStatus("found");
      setShowBoardConfirm(true);
    }
    if (dispatchStatus === "failed") {
      setShowNoRide(true);
      setSearchStatus("failed");
    }
  }, [dispatchStatus]);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.5,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    startSearch();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startSearch, scaleAnim, opacityAnim]);

  // Fetch nearby vehicles count once on mount
  useEffect(() => {
    if (pickupLat == null || pickupLon == null) return;
    let cancelled = false;
    (async () => {
      try {
        const vehicles = await getNearbyVehicles(pickupLat, pickupLon, "auto", 2000);
        if (!cancelled) setNearbyCount(vehicles.length);
      } catch {
        if (!cancelled) setNearbyCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [pickupLat, pickupLon]);

  const handleLowerHand = useCallback(async () => {
    const reqId = boardingRequest?.id || boardingRequest?.request_id || boardingRequestId;
    if (!reqId || cancelling) return;
    setCancelling(true);
    try {
      await cancelBoardingRequest(reqId);
      setHandRaised(false);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to cancel boarding request:", error);
      setHandRaised(false);
      navigation.goBack();
    }
  }, [boardingRequest, boardingRequestId, cancelling, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          ref={mapRef}
          cameraRef={cameraRef}
          scrollEnabled={true}
          zoomEnabled={true}
          initialViewState={
            pickupLat != null && pickupLon != null
              ? { center: [pickupLon, pickupLat], zoom: 15 }
              : { center: [80.8, 26.8], zoom: 12 }
          }
        >
          {pickupLat != null && pickupLon != null && (
            <ViewAnnotation key={`pickup`} lngLat={[pickupLon, pickupLat]} anchor="center">
              <View style={styles.userDot}>
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </View>
            </ViewAnnotation>
          )}
        </VayyMap>

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
            <Text style={styles.headerTitle}>Finding Auto...</Text>
          </View>
        </View>

        <View style={styles.pulseContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          />
          <View style={styles.userDotPulse}>
            <Ionicons name="person" size={20} color="#FFFFFF" />
          </View>
        </View>

        <View style={[styles.floatingContainer, { top: insets.top + 80 }]}>
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

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        <View style={styles.availabilityRow}>
          <View style={styles.availItem}>
            <Ionicons name="car" size={18} color="#009849" />
            <Text style={styles.availText}>
              <Text style={styles.availBold}>{nearbyCount != null ? nearbyCount : "—"}</Text> autos nearby
            </Text>
          </View>
          <View style={styles.availDivider} />
          <View style={styles.availItem}>
            <Ionicons name="time-outline" size={18} color="#009849" />
            <Text style={styles.availText}>
              <Text style={styles.availBold}>
                {nearbyCount != null ? `~${Math.max(1, Math.round(15 / Math.max(nearbyCount, 1)))} min` : "—"}
              </Text> avg. wait
            </Text>
          </View>
        </View>

        <View style={styles.searchingInfo}>
          <Text style={styles.searchingTitle}>
            {searchStatus === "found" ? "Auto Found!" : "Searching for nearby autos..."}
          </Text>
          <Text style={styles.searchingSub}>
            {searchStatus === "found"
              ? "Auto driver has been notified"
              : "Your location has been shared with nearby auto drivers"}
          </Text>
        </View>

        {searchStatus === "found" ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.foundBtn}
            onPress={() => setShowBoardConfirm(true)}
          >
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            <Text style={styles.foundBtnText}>  Auto Found! Tap to board</Text>
          </TouchableOpacity>
        ) : handRaised ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.lowerHandBtn}
            onPress={handleLowerHand}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="hand-left" size={22} color="#FFFFFF" />
            )}
            <Text style={styles.lowerHandText}>
              {cancelling ? "Lowering..." : "  Lower Hand"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={1} style={styles.raisedBtn} disabled>
            <Text style={styles.raisedText}>✋  Hand Lowered</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => setShowCancelConfirm(true)} style={styles.cancelLink}>
          <Text style={styles.cancelLinkText}>Cancel Request</Text>
        </TouchableOpacity>
      </View>

      <NoRideFoundPopup
        visible={showNoRide}
        onTryAgain={handleTryAgain}
        onCancel={() => setShowNoRide(false)}
      />

      <ConfirmPopup
        visible={showBoardConfirm}
        title="Boarded the Auto?"
        message={`Confirm if you've boarded the auto at ${pickupName}. Your ride will start.`}
        confirmLabel="Yes, I'm on board"
        icon="checkmark-circle-outline"
        onConfirm={() => {
          setShowBoardConfirm(false);
          const tripObj = activeTripData || trip || {};
          const tripId = tripObj.trip_id || tripObj.id || "";
          const fare = tripObj.fare || 0;
          const distMeters = tripObj.total_distance_meters || 0;
          const etaSec = tripObj.eta_seconds || 0;
          const distKm = distMeters > 1000 ? `${(distMeters / 1000).toFixed(1)} km` : `${distMeters} m`;
          const durMin = Math.max(1, Math.round(etaSec / 60));
          navigation.navigate('AutoRideActive', {
            tripId,
            dispatchId: activeDispatch?.id || "",
            destination: tripObj.destination || destination,
            fare,
            distance: distKm,
            eta: `${durMin} min`,
            driverName: tripObj.driver?.name || tripObj.driver_name || "Auto Driver",
            vehicle: tripObj.vehicle?.number || tripObj.vehicle_number || "",
            tripData: tripObj,
            route_id,
          });
        }}
        onCancel={() => setShowBoardConfirm(false)}
      />

      <ConfirmPopup
        visible={showCancelConfirm}
        title="Cancel Request?"
        message="Your hand raise request will be cancelled and the driver will be notified."
        confirmLabel="Yes, Cancel"
        confirmColor="#EF4444"
        icon="close-circle-outline"
        onConfirm={() => {
          setShowCancelConfirm(false);
          handleLowerHand();
        }}
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
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  gradBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#009849",
  },
  gradRay1: {
    position: "absolute",
    top: -60,
    right: -20,
    width: 260,
    height: 200,
    backgroundColor: "#00B857",
    opacity: 0.25,
    transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute",
    bottom: -90,
    right: 40,
    width: 240,
    height: 180,
    backgroundColor: "#FFFFFF",
    opacity: 0.1,
    transform: [{ rotate: "35deg" }],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
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
  mapArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  pulseContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "#009849",
    backgroundColor: "rgba(0, 152, 73, 0.1)",
  },
  userDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  userDotPulse: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  floatingContainer: {
    position: "absolute",
    right: 16,
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  floatBtn: {
    width: 48,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  floatDivider: {
    width: 28,
    height: 1,
    backgroundColor: "#F0F0F0",
    alignSelf: "center",
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
  lowerHandBtn: {
    height: 60,
    borderRadius: 20,
    backgroundColor: "#F59E0B",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  lowerHandText: {
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
