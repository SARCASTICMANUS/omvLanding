import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import * as Location from "expo-location";
// import VayyMap, { GeoJSONSource, Layer, UserLocation, Marker } from "../../shared/components/VayyMap";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { ConfirmPopup } from "./ConfirmPopup";
import { fetchRouteGeometry } from "../../routes/services/routeService";

export function BikeMapPreRideScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [showConfirm, setShowConfirm] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(280);
  const [isMapReady, setIsMapReady] = useState(false);
  const [routePath, setRoutePath] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [currentZoomLevel, setCurrentZoomLevel] = useState(14);


  // Dedicated refs for Map and Camera instances
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const didFitRef = useRef(false);

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
    : [80.9462, 26.8467];

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

  // 2. WORKING ZOOM & LOCATION INTERFACE (V11 SPEC)
  const handleZoom = async (zoomIn) => {
    if (!cameraRef.current || !isMapReady) return;
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
    if (!cameraRef.current || !isMapReady) return;
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
    if (!cameraRef.current || !isMapReady) return;
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
    if (didFitRef.current || !cameraRef.current || !isMapReady) return;
    didFitRef.current = true;
    handleRecenterRouteBounds();
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon, sheetHeight, isMapReady]);
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Layer 1: Independent Map Engine Base */}
      {/* <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          mapRef={mapRef}
          cameraRef={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: 14,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
          onDidFinishLoadingMap={() => setIsMapReady(true)}
        >
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
      </View> */}

      {/* Layer 2: Floating Header UI Control Deck */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.headerLeft}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{route?.params?.title || "Bike pickup"}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="more-vert" size={24} color="#FFFFFF" />
        </TouchableOpacity>
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
              <Text style={styles.greenText}>{stopDistance} m</Text> away
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
        <TouchableOpacity style={styles.floatBtn} onPress={() => handleZoom(true)}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatBtn} onPress={() => handleZoom(false)}>
          <Text style={styles.zoomText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatBtn} onPress={handleGetCurrentLocation}>
          <MaterialIcons name="my-location" size={22} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatBtn} onPress={handleGetCurrentLocation}>
          <Feather name="navigation" size={22} color="#009849" />
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

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="location" size={24} color="#009849" />
            <Text style={styles.statLabel}>Nearest stop</Text>
            <Text style={styles.statMainBold}>{pickupName}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="walk" size={24} color="#009849" />
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValueGreen}>{stopDistance} <Text style={styles.smallUnit}>m</Text></Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="time-outline" size={24} color="#009849" />
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValueGreen}>{eta_sec} <Text style={styles.smallUnit}>min</Text></Text>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.9} style={styles.raiseBtn} onPress={() => setShowConfirm(true)}>
          <Text style={styles.raiseText}>✋ Raise Hand at Stop</Text>
        </TouchableOpacity>
      </View>

      <ConfirmPopup
        visible={showConfirm}
        title="Raise Hand at Stop?"
        message={`Are you at ${pickupName}? Nearby riders will be notified.`}
        confirmLabel="Yes, Raise Hand"
        icon="hand-left-outline"
        onConfirm={() => {
          setShowConfirm(false);
          navigation.navigate('BikeSearching', {
            route_id: routeId,
            pickup_stop_id: trip?.pickup_stop?.id,
            pickup: pickup,
            pickupName: pickupName,
            destination: dropoff,
            dropoffName: dropoffName,
            fare: route?.params?.fare,
          });
        }}
        onCancel={() => setShowConfirm(false)}
      />
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: "rgba(0,152,73,0.6)",
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
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
  poiLabel: {
    alignItems: "center",
    gap: 4,
  },
  poiText: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
  floatingContainer: {
    position: "absolute",
    right: 20,
    gap: 12,
    zIndex: 20,
  },
  floatBtn: {
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
  zoomText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
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
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 4,
  },
  statLabel: {
    color: "#888888",
    fontSize: 13,
    fontWeight: "500",
    textAlign: 'center',
  },
  statMainBold: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    color: "#111827",
    lineHeight: 20,
  },
  statValueGreen: {
    fontSize: 22,
    fontWeight: "800",
    color: "#009849",
  },
  smallUnit: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
  },
  raiseBtn: {
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
  raiseText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});