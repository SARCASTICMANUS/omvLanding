import React, { useRef, useState, useEffect } from "react";
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
} from "react-native";
import * as Location from "expo-location";
import VayyMap, { GeoJSONSource, Layer, UserLocation, Marker, ViewAnnotation } from "../../shared/components/VayyMap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { fetchRouteGeometry } from "../../routes/services/routeService";

const ARRIVAL_THRESHOLD = 500;

const USER_TOP_IMAGE = require("../../../assets-webp/VayyUserTop.webp");

function haversine(a, b) {
  const R = 6371e3;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDistance(meters) {
  if (meters == null) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function BikeMapPreRideScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [showConfirm, setShowConfirm] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(280);
  const [routePath, setRoutePath] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [currentZoomLevel, setCurrentZoomLevel] = useState(14);
  const [followMode, setFollowMode] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [walkingPath, setWalkingPath] = useState(null);

  // Dedicated refs for Map and Camera instances
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const didFitRef = useRef(false);

  // Search ring pulse animation
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // --- 1. REALTIME API / PARAMS INTEGRATION DATA ---
  const trip = route?.params?.trip || {};
  const pickup = route?.params?.pickup;
  const pickupName = pickup?.name || pickup?.display_name || trip?.pickup_stop?.name || "Pickup";
  const dropoff = route?.params?.destination;
  const dropoffName = dropoff?.name || dropoff?.display_name || trip?.dropoff_stop?.name || "Dropoff";
  const stopDistance = route?.params?.trip?.total_distance_meters || "-";
  const eta_sec = route?.params?.trip?.eta_seconds || "-";

  const routeId = route?.params?.route_id || trip?.id;
  const pickupStop = trip?.pickup_stop || {};
  const dropoffStop = trip?.dropoff_stop || {};

  const pickupLat = typeof pickupStop?.lat === "number" ? pickupStop.lat : null;
  const pickupLon = typeof pickupStop?.lon === "number" ? pickupStop.lon : null;
  const dropoffLat = typeof dropoffStop?.lat === "number" ? dropoffStop.lat : null;
  const dropoffLon = typeof dropoffStop?.lon === "number" ? dropoffStop.lon : null;

  const initialCenter = pickupLat != null && pickupLon != null
    ? [pickupLon, pickupLat]
    : null;

  const hasDistance = stopDistance !== "-" && Number.isFinite(Number(stopDistance));
  const liveWalkDistance = userLocation && pickupLat != null && pickupLon != null
    ? haversine(userLocation, { latitude: pickupLat, longitude: pickupLon })
    : null;
  const distNum = liveWalkDistance != null ? liveWalkDistance : (hasDistance ? Number(stopDistance) : null);
  const isNearby = distNum == null ? true : distNum <= ARRIVAL_THRESHOLD;

  // Fetch route geometry on mount
  useEffect(() => {
    const loadRoute = async () => {
      if (!routeId) return;
      try {
        const data = await fetchRouteGeometry(routeId);
        if (data?.path) {
          setRoutePath(data.path);
        }
        if (data?.stops) {
          setRouteStops(data.stops);
        }
      } catch (e) {
        console.warn("Failed to load route geometry", e);
      }
    };
    loadRoute();
  }, [routeId]);

  // Fetch the rider's actual location to compute walking distance + walking line
  useEffect(() => {
    let cancelled = false;
    const locateUser = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        let loc = null;
        try {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 4000,
          });
        } catch {
          loc = await Location.getLastKnownPositionAsync();
        }
        if (loc?.coords && !cancelled) {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (e) {
        console.warn("Failed to locate user for walking distance", e);
      }
    };
    locateUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Walking line path from the rider's actual location to the nearest pickup stop
  useEffect(() => {
    if (userLocation && pickupLat != null && pickupLon != null) {
      setWalkingPath({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [userLocation.longitude, userLocation.latitude],
                [pickupLon, pickupLat],
              ],
            },
          },
        ],
      });
    }
  }, [userLocation, pickupLat, pickupLon]);

  // Continuous search ring pulse around the buddy location
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

  // 2. WORKING ZOOM & LOCATION INTERFACE (V11 SPEC)
  const handleZoom = async (zoomIn) => {
    if (!cameraRef.current) return;
    try {
      let targetZoom = currentZoomLevel;
      if (mapRef.current && typeof mapRef.current.getZoom === "function") {
        const nativeZoom = await mapRef.current.getZoom();
        if (nativeZoom) targetZoom = nativeZoom;
      }
      const nextZoom = zoomIn ? targetZoom + 1 : targetZoom - 1;
      const clampedZoom = Math.max(1, Math.min(nextZoom, 22));
      setCurrentZoomLevel(clampedZoom);

      cameraRef.current.setStop({
        zoom: clampedZoom,
        duration: 250,
      });
    } catch (e) {
      console.warn("Zoom processing failure", e);
    }
  };

  const handleGetCurrentLocation = async () => {
    if (!cameraRef.current) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      let loc = null;
      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 4000
        });
      } catch (err) {
        loc = await Location.getLastKnownPositionAsync();
      }

      if (loc?.coords) {
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        cameraRef.current.setStop({
          center: [loc.coords.longitude, loc.coords.latitude],
          zoom: 16,
          duration: 1000,
        });
      } else {
        cameraRef.current.setStop({
          center: initialCenter,
          zoom: 15,
          duration: 800,
        });
      }
    } catch (e) {
      console.warn("Location tracking execution failure", e);
    }
  };

  const handleRecenterRouteBounds = () => {
    if (!cameraRef.current) return;
    if (pickupLat != null && pickupLon != null && dropoffLat != null && dropoffLon != null) {
      const pad = 0.005;
      const west = Math.min(pickupLon, dropoffLon) - pad;
      const south = Math.min(pickupLat, dropoffLat) - pad;
      const east = Math.max(pickupLon, dropoffLon) + pad;
      const north = Math.max(pickupLat, dropoffLat) + pad;

      cameraRef.current.fitBounds(
        [west, south, east, north],
        { top: insets.top + 120, right: 60, bottom: sheetHeight + 40, left: 60 },
        800,
      );
    } else {
      cameraRef.current.setStop({ center: initialCenter, zoom: 15, duration: 600 });
    }
  };

  useEffect(() => {
    if (didFitRef.current || !cameraRef.current) return;
    didFitRef.current = true;
    handleRecenterRouteBounds();
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon, sheetHeight]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Layer 1: Map */}
      <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          ref={mapRef}
          cameraRef={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: 14,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
        >
          <GeoJSONSource id="walkSource" data={walkingPath} />
          <Layer
            id="walkLayer"
            type="line"
            source="walkSource"
            paint={{
              "line-color": "#009849",
              "line-width": 2.5,
              "line-dasharray": [2, 1],
              "line-join": "round",
              "line-cap": "round",
            }}
          />
          <GeoJSONSource id="routeSource" data={routePath} />
          <Layer
            id="routeLayer"
            type="line"
            source="routeSource"
            paint={{
              "line-color": "#009849",
              "line-width": 5,
              "line-join": "round",
              "line-cap": "round",
            }}
          />
          {routeStops.map((stop) => {
            const coords = stop.location?.coordinates;
            if (!coords || coords.length < 2) return null;
            const isPickup = stop.id === pickupStop?.id;
            const isDropoff = stop.id === dropoffStop?.id;
            if (isPickup || isDropoff) return null;
            return (
              <Marker key={stop.id} lngLat={coords}>
                <View style={styles.routeStopMarker}>
                  <View style={styles.routeStopDot} />
                  <View style={styles.routeStopLabel}>
                    <Text style={styles.routeStopLabelText} numberOfLines={1}>
                      {stop.name}
                    </Text>
                  </View>
                </View>
              </Marker>
            );
          })}
          <UserLocation />
          {userLocation && (
            <ViewAnnotation id="user-pulse" lngLat={[userLocation.longitude, userLocation.latitude]}>
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
          {pickupLon != null && pickupLat != null && (
            <Marker lngLat={[pickupLon, pickupLat]}>
              <View style={styles.stopMarkerGroup}>
                <View style={styles.stopLabel}>
                  <Text style={styles.stopLabelText}>{pickupName}</Text>
                  <View style={styles.labelArrow} />
                </View>
                <View style={styles.stopMarkerOuter}>
                  <View style={styles.stopMarker}>
                    <Ionicons name="flag" size={18} color="#FFFFFF" />
                  </View>
                </View>
              </View>
            </Marker>
          )}
        </VayyMap>
      </View>

      {/* Layer 2: Floating Header UI Control Deck */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerGradient}>
          <View style={styles.gradBase} />
          <View style={styles.gradRay1} />
          <View style={styles.gradRay2} />
        </View>
        <View style={styles.headerRow}>
          {Platform.OS === "ios" && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Hand Raise</Text>
        </View>
      </View>

      {/* Layer 3: Dynamic Context Cards */}
      <View style={[styles.topOverlaysContainer, { top: insets.top + 75 }]}>
        <View style={styles.distanceCard}>
          <View style={styles.flagWrapper}>
            <Ionicons name="flag" size={24} color="#009849" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Nearest stop</Text>
            <Text style={styles.cardDistance}>
              <Text style={styles.greenText}>{formatDistance(distNum)}</Text> away
            </Text>
          </View>
          <View style={styles.etaBadge}>
            <Text style={styles.etaBadgeValue}>~{eta_sec} min</Text>
            <Text style={styles.etaBadgeLabel}>wait</Text>
          </View>
        </View>

        <View style={styles.liveBikesChip}>
          <View style={styles.liveDot} />
          <Ionicons name="bicycle" size={16} color="#009849" />
          <Text style={styles.liveBikesText}>{route?.params?.bikesOnRoute || "0"} bikes on route</Text>
        </View>
      </View>

      {/* Layer 4: Floating Action Interface Controls */}
      <View style={[styles.floatingContainer, { bottom: sheetHeight + 20 }]}>
        <TouchableOpacity style={styles.floatBtn} onPress={() => { handleZoom(true); setFollowMode(false); }}>
          <Ionicons name="add" size={22} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatBtn} onPress={() => { handleZoom(false); setFollowMode(false); }}>
          <Ionicons name="remove" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.floatDivider} />
        <TouchableOpacity
          style={[styles.floatBtn, followMode && styles.floatBtnActive]}
          onPress={() => { handleGetCurrentLocation(); setFollowMode(true); }}
        >
          <MaterialIcons name="my-location" size={22} color={followMode ? "#FFFFFF" : "#111827"} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatBtn} onPress={() => { handleRecenterRouteBounds(); setFollowMode(false); }}>
          <Ionicons name="scan-outline" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Layer 5: Reactive Bottom Data Sheet */}
      <View
        style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          if (height > 0) setSheetHeight(height);
        }}
      >
        <View style={styles.handle} />

        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Selected Route</Text>
          <View style={styles.sheetRouteRow}>
            <View style={styles.sheetRouteDot} />
            <Text style={styles.sheetRouteText} numberOfLines={1}>
              {pickupName} → {dropoffName}
            </Text>
          </View>
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetLabel}>Nearest Pickup Stop</Text>
          <Text style={styles.sheetStopName}>{pickupName}</Text>
        </View>

        <View style={[styles.sheetStatusCard, isNearby ? styles.sheetStatusReady : styles.sheetStatusAway]}>
          <View style={[styles.sheetStatusDot, isNearby ? styles.sheetStatusDotReady : styles.sheetStatusDotAway]} />
          <View style={styles.sheetStatusCol}>
            <Text style={[styles.sheetStatusText, isNearby ? styles.sheetStatusTextReady : styles.sheetStatusTextAway]}>
              {isNearby
                ? "You're at the pickup stop. Nearby Marshals are ready to be notified."
                : "You're not at the pickup stop. Get closer to get notified."}
            </Text>
            <Text style={[styles.sheetStatusDist, isNearby ? styles.sheetStatusDistReady : styles.sheetStatusDistAway]}>
              {formatDistance(distNum)} away
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.raiseBtn, !isNearby && styles.raiseBtnDisabled]}
          onPress={() => { if (isNearby) setShowConfirm(true); }}
          disabled={!isNearby}
        >
          <Text style={[styles.raiseText, !isNearby && styles.raiseTextDisabled]}>✋ Raise Hand</Text>
        </TouchableOpacity>
      </View>

      {/* Raise Hand Confirmation Modal */}
      {showConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Image
                source={require("../../../assets-webp/VayyHandRaise.webp")}
                style={{ width: 120, height: 120 }}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.modalTitle}>Raise Hand?</Text>
            <Text style={styles.modalMessage}>
              Nearby{"\n"}Marshals will be notified that you are waiting at the stop.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={() => {
                  setShowConfirm(false);
                  navigation.navigate("BikeSearching", {
                    route_id: routeId,
                    pickup_stop_id: trip?.pickup_stop?.id,
                    pickup: pickup,
                    pickupName: pickupName,
                    destination: dropoffName,
                    dropoffName: dropoffName,
                    fare: route?.params?.fare,
                  });
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>Raise Hand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  mapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  headerGradient: {
    ...StyleSheet.absoluteFill,
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  topOverlaysContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 10,
    gap: 10,
  },
  distanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 4,
  },
  flagWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardLabel: {
    fontSize: 14,
    color: "#888888",
    fontWeight: "500",
    marginBottom: 2,
  },
  cardDistance: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  greenText: {
    color: "#009849",
  },
  etaBadge: {
    backgroundColor: "#ECFAF1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  etaBadgeValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#009849",
  },
  etaBadgeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  liveBikesChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#009849",
  },
  liveBikesText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  stopMarkerGroup: {
    alignItems: "center",
    marginTop: -40,
  },
  stopLabel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 6,
  },
  stopLabelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    lineHeight: 18,
  },
  labelArrow: {
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    width: 10,
    height: 10,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
  stopMarkerOuter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,152,73,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  stopMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  routeStopMarker: {
    alignItems: "center",
    marginTop: -10,
  },
  routeStopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#009849",
  },
  routeStopLabel: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  routeStopLabelText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#374151",
    maxWidth: 70,
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
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
  },
  floatBtn: {
    width: 48,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  floatBtnActive: {
    backgroundColor: "#009849",
    borderRadius: 12,
    marginHorizontal: 4,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 30,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetSection: {
    marginBottom: 12,
  },
  sheetLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sheetRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetRouteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#009849",
  },
  sheetRouteText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  sheetStopName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  sheetStatusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  sheetStatusAway: {
    backgroundColor: "#FEF2F2",
  },
  sheetStatusReady: {
    backgroundColor: "#ECFAF1",
  },
  sheetStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  sheetStatusDotAway: {
    backgroundColor: "#EF4444",
  },
  sheetStatusDotReady: {
    backgroundColor: "#009849",
  },
  sheetStatusCol: {
    flex: 1,
    gap: 4,
  },
  sheetStatusText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  sheetStatusTextAway: {
    color: "#991B1B",
  },
  sheetStatusTextReady: {
    color: "#065F46",
  },
  sheetStatusDist: {
    fontSize: 13,
    fontWeight: "700",
  },
  sheetStatusDistAway: {
    color: "#DC2626",
  },
  sheetStatusDistReady: {
    color: "#009849",
  },
  raiseBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#009849", shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  raiseBtnDisabled: {
    backgroundColor: "rgba(0,152,73,0.3)",
    shadowOpacity: 0,
    elevation: 0,
  },
  raiseText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  raiseTextDisabled: {
    color: "rgba(255,255,255,0.5)",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 102,
    height: 102,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalBtnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },
  modalBtnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
