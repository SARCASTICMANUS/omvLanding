import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import VayyMap from "../../shared/components/VayyMap";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
  Feather,
} from "@expo/vector-icons";

import { ConfirmPopup } from "./ConfirmPopup";

const { width } = Dimensions.get("window");

export function BikeMapPreRideScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [showConfirm, setShowConfirm] = useState(false);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const didFitRef = useRef(false);

  const trip = route?.params?.trip || {};
  const pickup = route?.params?.pickup;
  const pickupName = pickup?.name || pickup?.display_name || trip?.pickup_stop?.name || "Pickup";
  const dropoff = route?.params?.destination;
  const dropoffName = dropoff?.name || dropoff?.display_name || trip?.dropoff_stop?.name || "Dropoff";
  const stopDistance = route?.params?.stopDistance || 200;
  const eta = route?.params?.eta || "2";
  const routeId = route?.params?.route_id || trip?.id;
  const pickupStopId = route?.params?.pickup_stop_id || trip?.pickup_stop?.id;

  const pickupStop = trip?.pickup_stop || {};
  const dropoffStop = trip?.dropoff_stop || {};

  const pickupLat = typeof pickupStop?.lat === "number" ? pickupStop.lat : null;
  const pickupLon = typeof pickupStop?.lon === "number" ? pickupStop.lon : null;
  const dropoffLat = typeof dropoffStop?.lat === "number" ? dropoffStop.lat : null;
  const dropoffLon = typeof dropoffStop?.lon === "number" ? dropoffStop.lon : null;

  const initialCenter = pickupLat != null && pickupLon != null
    ? [pickupLon, pickupLat]
    : [80.9462, 26.8467];

  useEffect(() => {
    if (didFitRef.current) return;
    if (!cameraRef.current) return;

    const tryFit = (attempt) => {
      if (attempt > 15) return;
      if (!cameraRef.current) {
        setTimeout(() => tryFit(attempt + 1), 200);
        return;
      }
      didFitRef.current = true;

      if (pickupLat != null && pickupLon != null) {
        const pad = 0.005;
        if (dropoffLat != null && dropoffLon != null) {
          const west = Math.min(pickupLon, dropoffLon) - pad;
          const south = Math.min(pickupLat, dropoffLat) - pad;
          const east = Math.max(pickupLon, dropoffLon) + pad;
          const north = Math.max(pickupLat, dropoffLat) + pad;
          cameraRef.current.fitBounds(
            [west, south, east, north],
            { top: insets.top + 80, right: 50, bottom: 250, left: 50 },
            500,
          );
        } else {
          cameraRef.current.setStop({ center: [pickupLon, pickupLat], zoom: 15, duration: 500 });
        }
      } else {
        cameraRef.current.setStop({ center: [80.9462, 26.8467], zoom: 13, duration: 500 });
      }
    };
    setTimeout(() => tryFit(0), 100);
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon, insets.top]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Map Area */}
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
        />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.headerLeft}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>{route?.params?.title || "Bike pickup"}</Text>
          </View>

          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="more-vert" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Top Distance Card */}
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
            <Text style={styles.etaBadgeValue}>~{eta} min</Text>
            <Text style={styles.etaBadgeLabel}>wait</Text>
          </View>
        </View>

        {/* Charbagh Label */}
        <View style={styles.poiLabel}>
          <Ionicons name="train-outline" size={14} color="#60A5FA" />
          <Text style={styles.poiText}>{dropoff}</Text>
        </View>

        {/* Stop Label with Arrow */}
        <View style={styles.stopLabel}>
          <Text style={styles.stopLabelText}>
            {pickupName.replace(" ", "\n")}
          </Text>
          <View style={styles.labelArrow} />
        </View>

        {/* Stop Marker */}
        <View style={styles.stopMarkerOuter}>
          <View style={styles.stopMarker}>
            <Ionicons name="flag" size={20} color="#FFFFFF" />
          </View>
        </View>

        {/* Route Path (Solid Green) */}
        <View style={styles.routeContainer}>
          <View style={styles.routeSegment1} />
          <View style={styles.routeSegment2} />
          <View style={styles.routeSegment3} />
          <View style={styles.routeMidDot} />
        </View>

        {/* Bike Marker */}
        <View style={styles.bikeMarker}>
          <Text style={{ fontSize: 24 }}>🏍️</Text>
        </View>

        {/* Live Bikes on Route Chip */}
        <View style={styles.liveBikesChip}>
          <View style={styles.liveDot} />
          <Ionicons name="bicycle" size={16} color="#009849" />
          <Text style={styles.liveBikesText}>{route?.params?.bikesOnRoute || "3"} bikes on route</Text>
        </View>

        {/* Floating Buttons */}
        <View style={styles.floatingContainer}>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomOut}>
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn}>
            <MaterialIcons name="my-location" size={24} color="#111827" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.floatBtn}>
            <Feather name="navigation" size={24} color="#009849" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="location" size={24} color="#009849" />
            <Text style={styles.statLabel}>Nearest stop</Text>
            <Text style={styles.statMainBold}>
              {pickupName.replace(" ", "\n")}
            </Text>
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
            <Text style={styles.statValueGreen}>{eta} <Text style={styles.smallUnit}>min</Text></Text>
          </View>
        </View>

        <TouchableOpacity 
          activeOpacity={0.9} 
          style={styles.raiseBtn}
          onPress={() => setShowConfirm(true)}
        >
          <Text style={styles.raiseText}>✋  Raise Hand at Stop</Text>
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
            route_id: route?.params?.route_id,
            pickup_stop_id: route?.params?.pickup_stop_id,
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
    backgroundColor: "rgba(0,152,73,0.6)",
    overflow: "hidden",
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  distanceCard: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    zIndex: 10,
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
  mapArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F9FAFB",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  poiLabel: {
    position: "absolute",
    top: "35%",
    left: "15%",
    alignItems: "center",
    gap: 4,
  },
  poiText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  stopLabel: {
    position: "absolute",
    top: 100,
    right: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    bottom: -6,
    right: 12,
    width: 12,
    height: 12,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
  stopMarkerOuter: {
    position: "absolute",
    top: 95,
    right: 55,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,152,73,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  stopMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  routeContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  routeSegment1: {
    position: "absolute",
    top: 160,
    right: 80,
    width: 4,
    height: 120,
    backgroundColor: "#009849",
    borderRadius: 2,
  },
  routeSegment2: {
    position: "absolute",
    top: 275,
    right: 80,
    width: 110,
    height: 4,
    backgroundColor: "#009849",
    transform: [{ rotate: "45deg" }, { translateX: -35 }],
    borderRadius: 2,
  },
  routeSegment3: {
    position: "absolute",
    top: 380,
    left: "48%",
    width: 4,
    height: 100,
    backgroundColor: "#009849",
    borderRadius: 2,
  },
  routeMidDot: {
    position: "absolute",
    top: 360,
    left: "47.5%",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#009849",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  bikeMarker: {
    position: "absolute",
    bottom: 180,
    left: "38%",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  liveBikesChip: {
    position: "absolute",
    top: 195,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00E676",
  },
  liveBikesText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  floatingContainer: {
    position: "absolute",
    right: 20,
    bottom: 200,
    gap: 12,
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
    paddingBottom: 24,
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
    marginBottom: 24,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: "100%",
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
  zoomText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
});
