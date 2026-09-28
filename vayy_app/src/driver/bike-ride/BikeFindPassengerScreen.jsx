import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import * as Location from "expo-location";
import { WS } from "../../constants";
import { acceptBroadcast, rejectBroadcast, acceptDispatch, rejectDispatch } from "../../store/slices/dispatchSlice";
import { getAssignedVehicle } from "../services/driverService";
import useDriverLocationPush from "../hooks/useDriverLocationPush";
import useWebSocket from "../../shared/hooks/useWebSocket";
import COLORS from "../../shared/constants/colors";
import VayyMap, { ViewAnnotation } from "../../shared/components/VayyMap";
import ZoomControls from "../../shared/components/common/ZoomControls";

const { height } = Dimensions.get("window");

const VEHICLE_IMAGES = [
  require("../../../assets/vayyWithoutPassengerBike.webp"),
  require("../../../assets/vayyWithoutPassengerBike2.webp"),
  require("../../../assets/vayyWithoutPassengerBike3.webp"),
  require("../../../assets/vayyWithoutPassengerBike4.webp"),
];

const CHECKS = [
  { key: "network", label: "Network", icon: "wifi" },
  { key: "gps", label: "GPS", icon: "navigate" },
  { key: "location", label: "Location", icon: "location" },
  { key: "helmet", label: "Wear Helmet", icon: "shield-checkmark" },
  { key: "stand", label: "Kickstand Up", icon: "footsteps" },
  { key: "device", label: "Bike Ready", icon: "bicycle" },
];

export default function BikeFindPassengerScreen({ navigation, route: navRoute }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const userId = user?.id;
  const [showVerify, setShowVerify] = useState(true);
  const [checks, setChecks] = useState(CHECKS.map((c) => ({ ...c, status: "pending" })));
  const [allPassed, setAllPassed] = useState(false);
  const [vehicleIdx, setVehicleIdx] = useState(0);
  const [phase, setPhase] = useState("scanning");
  const [online, setOnline] = useState(false);
  const [currentBuddy, setCurrentBuddy] = useState(null);
  const [notification, setNotification] = useState(null);
  const [scanSeconds, setScanSeconds] = useState(60);
  const notifSlide = useRef(new Animated.Value(-100)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const [bikePos, setBikePos] = useState(null);
  const mapRef = useRef(null);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleWsMessage = useCallback((data) => {
    // New broadcast dispatch request from a passenger
    if (data.type === "new_dispatch_request" && data.dispatch) {
      const req = data.dispatch;
      const realBuddy = {
        id: req.request_id || req.id || req.trip_id || "ws_req",
        requestId: req.request_id || null,
        dispatchId: req.request_id || req.id || req.trip_id,
        name: req.passenger_name || req.user_name || "Passenger",
        rating: req.passenger_rating || null,
        trips: req.passenger_trips || 0,
        pickup: (() => { const p = req.pickup_name || req.pickup; return typeof p === "string" ? p : p?.name || p?.display_name || "Pickup"; })(),
        drop: (() => { const d = req.drop_name || req.drop; return typeof d === "string" ? d : d?.name || d?.display_name || "Destination"; })(),
        pickupLat: req.pickup_lat || req.pickup_latitude || null,
        pickupLng: req.pickup_lng || req.pickup_longitude || null,
        dropLat: req.drop_lat || req.drop_latitude || null,
        dropLng: req.drop_lng || req.drop_longitude || null,
        distance: req.distance_km != null ? req.distance_km : null,
        distanceDisplay: req.distance_km != null ? `${req.distance_km} km` : "—",
        duration: req.duration || req.duration_min || null,
        fare: req.fare ? `₹${req.fare}` : "—",
        fareAmount: req.fare || 0,
        eta: req.eta ? `${req.eta} min` : "—",
        otp: req.otp || null,
        route_id: req.route_id || null,
        route_name: req.route_name || null,
        avatar: (req.passenger_name || "P").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "P",
      };
      setCurrentBuddy(realBuddy);
      setPhase("found");
      if (!online) setOnline(true);
      // Slide up the bottom sheet popup
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
      // Show notification banner
      const pickupName = realBuddy.pickup || "nearby";
      setNotification(`Passenger waiting at ${pickupName}`);
      Animated.spring(notifSlide, { toValue: 0, friction: 10, tension: 50, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(notifSlide, { toValue: -100, duration: 300, useNativeDriver: true }).start(() => setNotification(null));
      }, 3000);
    }

    // Another driver accepted — dismiss this popup
    if (data.type === "request_cancelled") {
      setNotification("Request taken by another driver");
      Animated.spring(notifSlide, { toValue: 0, friction: 10, tension: 50, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(notifSlide, { toValue: -100, duration: 300, useNativeDriver: true }).start(() => setNotification(null));
      }, 2500);
      Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => {
        setCurrentBuddy(null);
        setPhase("scanning");
      });
    }

    // Request expired — dismiss popup
    if (data.type === "request_expired") {
      setNotification("Request expired");
      Animated.spring(notifSlide, { toValue: 0, friction: 10, tension: 50, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(notifSlide, { toValue: -100, duration: 300, useNativeDriver: true }).start(() => setNotification(null));
      }, 2500);
      Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => {
        setCurrentBuddy(null);
        setPhase("scanning");
      });
    }
  }, [slideAnim, notifSlide]);

  useWebSocket(userId ? WS.notifications(userId) : null, {
    enabled: !!userId,
    onMessage: handleWsMessage,
  });
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const verifySlide = useRef(new Animated.Value(0)).current;
  const verifyOpacity = useRef(new Animated.Value(0)).current;
  const scaleIn = useRef(new Animated.Value(0.9)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showVerify) return;
    verifyOpacity.setValue(0);
    verifySlide.setValue(0);
    Animated.parallel([
      Animated.timing(verifySlide, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(verifyOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleIn, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [showVerify, verifySlide, scaleIn, verifyOpacity]);

  useEffect(() => {
    if (!showVerify) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [showVerify, floatAnim]);

  useEffect(() => {
    if (!showVerify) return;
    const iv = setInterval(() => {
      setVehicleIdx((p) => (p + 1) % VEHICLE_IMAGES.length);
    }, 3000);
    return () => clearInterval(iv);
  }, [showVerify]);

  useEffect(() => {
    if (!showVerify) return;
    let cancelled = false;
    const run = async () => {
      const updated = CHECKS.map((c) => ({ ...c, status: "pending" }));
      for (let i = 0; i < updated.length; i++) {
        if (cancelled) return;
        updated[i] = { ...updated[i], status: "checking" };
        setChecks([...updated]);
        await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
        if (cancelled) return;
        updated[i] = { ...updated[i], status: "passed" };
        setChecks([...updated]);
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!cancelled) setAllPassed(true);
    };
    run();
    return () => { cancelled = true; };
  }, [showVerify]);

  useEffect(() => {
    if (!allPassed) return;
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, [allPassed, spinAnim]);

  const handleStart = () => {
    if (!allPassed) return;
    Animated.parallel([
      Animated.timing(verifySlide, { toValue: 0, duration: 350, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(verifyOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setShowVerify(false);
      setOnline(true);
      setPhase("scanning");
    });
  };

  const vehicleIdRef = useRef(null);
  const [vehicleReady, setVehicleReady] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);

  useEffect(() => {
    let stopped = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || stopped) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (stopped) return;
      const { latitude, longitude } = pos.coords;
      setBikePos({ latitude, longitude });
      setMapCenter({ latitude, longitude });
    })();
    return () => { stopped = true; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getAssignedVehicle();
        if (!cancelled) {
          vehicleIdRef.current = res?.data?.id || res?.id;
          setVehicleReady(!!vehicleIdRef.current);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Push token registration moved to the app-wide notification layer
  // (shared/lib/pushNotifications.js via useNotificationListener). It used to
  // live only here, so autodrivers never registered a token and PushService had
  // nothing to deliver to.

  useDriverLocationPush({
    enabled: online && vehicleReady,
    vehicleId: vehicleIdRef.current,
    onLocation: (loc) => setBikePos(loc),
  });

  useEffect(() => {
    if (!online) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    const sweep = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }),
    );
    sweep.start();
    const timer = setTimeout(() => {
      // Real integration: keep scanning until WS delivers a real dispatch request
      // No mock fallback — the scanning animation continues until handleWsMessage fires
    }, 4000);
    return () => {
      pulse.stop();
      sweep.stop();
      clearTimeout(timer);
    };
  }, [online, pulseAnim, sweepAnim]);

  useEffect(() => {
    if (!online || phase !== "scanning") return;
    setScanSeconds(60);
    const iv = setInterval(() => {
      setScanSeconds((s) => (s > 0 ? s - 1 : 60));
    }, 1000);
    return () => clearInterval(iv);
  }, [online, phase]);

  const handleAccept = async () => {
    let otp = null;
    let activeTripId = null;
    if (currentBuddy?.requestId) {
      try {
        const result = await dispatch(acceptBroadcast(currentBuddy.requestId)).unwrap();
        const payload = result?.data || result;
        otp = payload?.otp || null;
        activeTripId = payload?.trip_id || null;
      } catch (e) {
        console.warn("acceptBroadcast failed:", e);
      }
    } else if (currentBuddy?.dispatchId) {
      try {
        await dispatch(acceptDispatch(currentBuddy.dispatchId)).unwrap();
      } catch (e) {
        console.warn("acceptDispatch failed:", e);
      }
    }
    const tripId = activeTripId || currentBuddy?.dispatchId || currentBuddy?.requestId;
    const buddyWithOtp = { ...currentBuddy, otp: otp || currentBuddy?.otp, dispatchId: tripId };
    navigation.navigate("BikeRideToPickup", { buddy: buddyWithOtp, dispatchId: tripId });
  };

  const handleIgnore = () => {
    if (currentBuddy?.requestId) {
      dispatch(rejectBroadcast(currentBuddy.requestId));
    } else if (currentBuddy?.dispatchId) {
      // Fallback to direct dispatch reject
      dispatch(rejectDispatch(currentBuddy.dispatchId));
    }
    Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => {
      setCurrentBuddy(null);
      setPhase("scanning");
    });
  };

  const sweepRotate = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const verifyTranslate = verifySlide.interpolate({
    inputRange: [0, 1],
    outputRange: [-height, 0],
  });

  const renderCheckRow = (check) => (
    <View key={check.key} style={styles.vRow}>
      <View style={[styles.vRowIcon, check.status === "passed" && styles.vRowIconPassed]}>
        {check.status === "checking" ? (
          <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
            <Ionicons name="sync" size={16} color="#F59E0B" />
          </Animated.View>
        ) : check.status === "passed" ? (
          <Ionicons name="checkmark" size={16} color="#fff" />
        ) : (
          <Ionicons name="ellipse" size={8} color="rgba(255,255,255,0.5)" />
        )}
      </View>
      <Text style={[styles.vRowLabel, check.status === "checking" && styles.vRowLabelActive]}>
        {check.label}
      </Text>
      {check.status === "pending" && (
        <View style={styles.vRowStatus}>
          <Text style={styles.vRowStatusText}>Pending</Text>
        </View>
      )}
      {check.status === "checking" && (
        <View style={[styles.vRowStatus, styles.vRowStatusChecking]}>
          <Text style={[styles.vRowStatusText, styles.vRowStatusCheckingText]}>Checking</Text>
        </View>
      )}
      {check.status === "passed" && (
        <View style={[styles.vRowStatus, styles.vRowStatusPassed]}>
          <Text style={[styles.vRowStatusText, styles.vRowStatusPassedText]}>Ready</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Real map background */}
      {!mapCenter ? (
        <View style={styles.gpsLoadingOverlay}>
          <Text style={styles.gpsLoadingText}>Getting your location...</Text>
        </View>
      ) : (
      <VayyMap
        ref={mapRef}
        initialViewState={{
          center: [mapCenter.longitude, mapCenter.latitude],
          zoom: 14,
        }}
        style={styles.map}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <ViewAnnotation
          id="passenger"
          lngLat={
            currentBuddy?.pickupLng && currentBuddy?.pickupLat
              ? [currentBuddy.pickupLng, currentBuddy.pickupLat]
              : [0, 0]
          }
        >
          <View style={[
            styles.passengerMarker,
            { opacity: currentBuddy?.pickupLng ? 1 : 0 },
          ]}>
            <View style={styles.passengerDot} />
          </View>
        </ViewAnnotation>
        <ViewAnnotation
          id="bike"
          lngLat={bikePos ? [bikePos.longitude, bikePos.latitude] : [0, 0]}
        >
          <View style={[
            styles.bikeMarker,
            { opacity: bikePos ? 1 : 0 },
          ]}>
            <Ionicons name="bicycle" size={22} color="#fff" />
          </View>
        </ViewAnnotation>
      </VayyMap>
      )}

      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

      {/* Overlay tint */}
      <View style={styles.overlayTint} />

      {/* Radar center */}
      <View style={styles.radarCenter} pointerEvents="none">
        {online && (
          <>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.pulseRing, styles.pulseRing2, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.pulseRing, styles.pulseRing3, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.sweepArc, { transform: [{ rotate: sweepRotate }] }]}>
              <View style={styles.sweepCone} />
            </Animated.View>
          </>
        )}
      </View>

      {/* Status badge */}
      {online && phase === "scanning" && (
        <View style={styles.statusBadge}>
          <View style={styles.statusDotLive} />
          <Text style={styles.statusText}>Scanning nearby area...</Text>
        </View>
      )}

      {((online && phase === "found") || currentBuddy) && (
        <View style={[styles.statusBadge, styles.statusBadgeFound]}>
          <Ionicons name="person" size={14} color={COLORS.primary} />
          <Text style={styles.statusText}>Buddy found!</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buddy Radar</Text>
        <TouchableOpacity
          style={[styles.headerBtn, online && styles.headerBtnActive]}
          onPress={() => setOnline(!online)}
        >
          <Ionicons
            name={online ? "radio" : "radio-button-off"}
            size={20}
            color={online ? "#fff" : "#111827"}
          />
        </TouchableOpacity>
      </View>

      {/* Scan timer */}
      {online && phase === "scanning" && (
        <View style={[styles.scanTimerWrap, { top: insets.top + 58 }]}>
          <View style={styles.scanTimerHead}>
            <Text style={styles.scanTimerTitle}>Scanning for buddies</Text>
            <Text style={styles.scanTimerSecs}>
              {scanSeconds > 0 ? `${scanSeconds}s` : "Rescanning..."}
            </Text>
          </View>
          <View style={styles.scanTimerTrack}>
            <View style={[styles.scanTimerFill, { width: `${(scanSeconds / 60) * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Notification banner */}
      {notification && (
        <Animated.View style={[styles.notifBanner, { transform: [{ translateY: notifSlide }] }]}>
          <View style={styles.notifDot} />
          <Text style={styles.notifText}>{notification}</Text>
        </Animated.View>
      )}

      {/* Offline state */}
      {!showVerify && !online && (
        <View style={styles.offlineWrap}>
          <View style={styles.offlineIconWrap}>
            <Ionicons name="radio-button-off" size={36} color="rgba(0,0,0,0.15)" />
          </View>
          <Text style={styles.offlineTitle}>Radar Offline</Text>
          <Text style={styles.offlineSub}>Tap the radio icon to start</Text>
        </View>
      )}

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}
        pointerEvents={phase === "found" ? "auto" : "none"}
      >
        <View style={styles.handle} />
        {currentBuddy && phase === "found" && (
          <>
            <View style={styles.sheetHead}>
              <View style={styles.sheetAvatar}>
                <Ionicons name="person-circle" size={44} color={COLORS.primary} />
              </View>
              <View style={styles.sheetMeta}>
                <Text style={styles.sheetName}>{currentBuddy.name}</Text>
                <View style={styles.sheetRow}>
                  <Ionicons name="star" size={12} color="#FFB800" />
                  <Text style={styles.sheetRating}>{currentBuddy.rating || "—"}</Text>
                  <Text style={styles.sheetDivider}>|</Text>
                  <Text style={styles.sheetTrips}>{currentBuddy.trips || 0} trips</Text>
                </View>
              </View>
              <View style={styles.sheetFare}>
                <Text style={styles.sheetFareValue}>{currentBuddy.fare || "—"}</Text>
                <Text style={styles.sheetFareLabel}>est.</Text>
              </View>
            </View>

            <View style={styles.routeCard}>
              <View style={styles.routeDots}>
                <View style={styles.routeDotGreen} />
                <View style={styles.routeLine} />
                <View style={styles.routeDotRed} />
              </View>
              <View style={styles.routeInfo}>
                <View>
                  <Text style={styles.routeLabel}>FROM</Text>
                  <Text style={styles.routeName}>{currentBuddy.pickup || "Pickup"}</Text>
                </View>
                <View>
                  <Text style={styles.routeLabel}>TO</Text>
                  <Text style={styles.routeName}>{currentBuddy.drop || "Destination"}</Text>
                </View>
              </View>
              <View style={styles.routeMeta}>
                <View style={styles.distBadge}>
                  <Ionicons name="walk" size={12} color={COLORS.primary} />
                  <Text style={styles.distText}>{currentBuddy.distance || "—"}</Text>
                </View>
                <Text style={styles.etaText}>{currentBuddy.eta || "—"}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleIgnore} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#EF4444" />
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={handleAccept} activeOpacity={0.85}>
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.pickText}>Pick Up</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>

      {/* Verification overlay */}
      {showVerify && (
        <Animated.View style={[styles.verifyOverlay, { transform: [{ translateY: verifyTranslate }], opacity: verifyOpacity }]}>
          <View style={[styles.verifyCard, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.vCardHeader}>
              <Image source={require("../../../assets/vayyFrontBike.webp")} style={{ width: 16, height: 16, opacity: 0.5 }} resizeMode="contain" />
              <Text style={styles.vCardHeaderText}>Pre-Ride Check</Text>
            </View>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.vScrollContent}>
              <Animated.View style={{ transform: [{ scale: scaleIn }], alignItems: "center" }}>
                <View style={styles.vHero}>
                  <View style={styles.vTrackWrap}>
                    <Animated.Image
                      source={VEHICLE_IMAGES[vehicleIdx]}
                      style={{
                        width: 80, height: 80, resizeMode: "contain",
                        marginBottom: -10,
                        transform: [{
                          translateX: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }),
                        }],
                      }}
                    />
                    <View style={styles.vProgressTrack}>
                      <View
                        style={[
                          styles.vProgressFill,
                          { width: `${(checks.filter((c) => c.status === "passed").length / checks.length) * 100}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.vBadgeRow}>
                    <View style={styles.vBadge}>
                      <Text style={styles.vBadgeText}>
                        {checks.filter((c) => c.status === "passed").length}/{checks.length}
                      </Text>
                    </View>
                    {allPassed && (
                      <View style={[styles.vBadge, styles.vBadgeAllClear]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                        <Text style={[styles.vBadgeText, { color: "#fff" }]}>All Clear</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.verifyTitle}>Ready to Ride</Text>
                <Text style={styles.verifySub}>Verifying your setup</Text>
              </Animated.View>

              <View style={styles.vSectionHeader}>
                <Ionicons name="cog" size={13} color="rgba(255,255,255,0.5)" />
                <Text style={styles.vSectionLabel}>System</Text>
              </View>
              {checks.slice(0, 3).map(renderCheckRow)}

              <View style={[styles.vSectionHeader, { marginTop: 12 }]}>
                <Ionicons name="shield" size={13} color="rgba(255,255,255,0.5)" />
                <Text style={styles.vSectionLabel}>Safety</Text>
              </View>
              {checks.slice(3).map(renderCheckRow)}
            </ScrollView>

            {allPassed && (
              <TouchableOpacity style={styles.vStartBtn} onPress={handleStart} activeOpacity={0.85}>
                <View style={styles.vStartBtnInner}>
                  <Ionicons name="radio" size={20} color={COLORS.primary} />
                  <Text style={styles.vStartBtnText}>Go Live</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.vBottomDash} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  /* map */
  gpsLoadingOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F2A42",
  },
  gpsLoadingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  map: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },

  /* markers */
  passengerMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  passengerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#00E676",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#00E676",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  bikeMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },

  /* overlay tint */
  overlayTint: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(15,42,66,0.4)",
  },

  /* radar center */
  radarCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -110,
    marginTop: -110,
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: "rgba(0,230,118,0.15)",
  },
  pulseRing2: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  pulseRing3: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderColor: "rgba(0,230,118,0.25)",
  },
  sweepArc: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  sweepCone: {
    width: 90,
    height: 90,
    backgroundColor: "rgba(0,230,118,0.04)",
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    borderTopWidth: 2,
    borderTopColor: "rgba(0,230,118,0.3)",
    borderLeftWidth: 2,
    borderLeftColor: "rgba(0,230,118,0.3)",
    borderRightWidth: 2,
    borderRightColor: "rgba(0,230,118,0.3)",
  },

  /* status badge */
  statusBadge: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 5,
  },
  statusBadgeFound: {
    backgroundColor: "#ECFAF1",
  },
  statusDotLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  /* scan timer */
  scanTimerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  scanTimerHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  scanTimerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
  },
  scanTimerSecs: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  scanTimerTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  scanTimerFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },

  /* header */
  header: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerBtnActive: {
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },

  /* notification banner */
  notifBanner: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    paddingTop: 80,
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: "center",
    zIndex: 20,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginBottom: 8,
  },
  notifText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },

  /* offline */
  offlineWrap: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,42,66,0.95)",
    zIndex: 10,
  },
  offlineIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  offlineSub: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },

  /* bottom sheet */
  bottomSheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 20,
    zIndex: 30,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetMeta: {
    flex: 1,
  },
  sheetName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  sheetRating: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  sheetDivider: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  sheetTrips: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  sheetFare: {
    backgroundColor: "#ECFAF1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  sheetFareValue: {
    fontSize: 19,
    fontWeight: "900",
    color: COLORS.primary,
  },
  sheetFareLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: -1,
  },

  /* route card */
  routeCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
  },
  routeDots: {
    alignItems: "center",
    width: 12,
    paddingTop: 4,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#D1D5DB",
    marginVertical: 3,
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  routeInfo: {
    flex: 1,
    justifyContent: "space-between",
    gap: 10,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  routeName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 1,
  },
  routeMeta: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
  },
  distBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFAF1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  etaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  /* actions */
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 4,
  },
  skipBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },
  pickBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  pickText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },

  /* verify overlay */
  verifyOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 40,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  vCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    marginBottom: 8,
  },
  vCardHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  verifyCard: {
    width: "100%",
    height: height * 0.9,
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 15,
  },
  vScrollContent: {
    paddingBottom: 16,
  },
  vBottomDash: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: -4,
  },

  /* hero */
  vHero: { alignItems: "center", marginBottom: 12 },
  vTrackWrap: {
    alignItems: "center",
    width: "80%",
    maxWidth: 200,
    marginBottom: 4,
  },
  vProgressTrack: {
    width: "100%",
    height: 5,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 3,
    overflow: "hidden",
  },
  vProgressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  vBadgeRow: { flexDirection: "row", gap: 8 },
  vBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  vBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  vBadgeAllClear: {
    backgroundColor: "rgba(0,0,0,0.3)",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  verifyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  verifySub: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },

  /* sections */
  vSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 4,
    marginLeft: 2,
  },
  vSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  /* check rows */
  vRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 8,
    width: "100%",
  },
  vRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  vRowIconPassed: { backgroundColor: "rgba(255,255,255,0.35)" },
  vRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  vRowLabelActive: { color: "#FFFFFF", fontWeight: "700" },
  vRowStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  vRowStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  vRowStatusChecking: {
    backgroundColor: "rgba(245,158,11,0.2)",
  },
  vRowStatusCheckingText: {
    color: "#F59E0B",
  },
  vRowStatusPassed: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  vRowStatusPassedText: {
    color: "#FFFFFF",
  },

  /* start button */
  vStartBtn: { width: "100%", borderRadius: 16, overflow: "hidden", marginTop: 12 },
  vStartBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  vStartBtnText: { fontSize: 16, fontWeight: "800", color: COLORS.primary },
});
