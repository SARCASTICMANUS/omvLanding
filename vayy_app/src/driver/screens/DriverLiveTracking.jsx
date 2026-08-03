import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import VayyMap, { ViewAnnotation, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import { SafeAreaView } from "react-native-safe-area-context";

import VehicleIconBadge from "../../shared/components/common/VehicleIconBadge";
import LiveDot from "../../shared/components/common/LiveDot";
import VayyButton from "../../shared/components/common/VayyButton";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SHADOW from "../../shared/constants/shadow";
import SPACING from "../../shared/constants/spacing";
import ZoomControls from "../../shared/components/common/ZoomControls";
import { getNextStops } from "../services/driverService";
import { buildRouteSummary } from "../utils/driverFlowUtils";

const toCoord = (point) => {
  const lat = Number(point?.lat ?? point?.latitude);
  const lon = Number(point?.lon ?? point?.lng ?? point?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon)
    ? { latitude: lat, longitude: lon }
    : null;
};

export default function DriverLiveTracking({ navigation, route: navRoute }) {
  const { route, activeTrip } = navRoute?.params || {};
  const [vehiclePos, setVehiclePos] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [nextStops, setNextStops] = useState([]);
  const [passengers, setPassengers] = useState({});
  const [wsStatus, setWsStatus] = useState("connecting");
  const [isDriving, setIsDriving] = useState(true);
  const mapRef = useRef(null);
  const sendRef = useRef(null);
  const markers = useRef({});
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const summary = useMemo(() => buildRouteSummary(route || {}), [route]);
  const tripId = activeTrip?.trip_id || activeTrip?.id;
  const cityId = activeTrip?.city_id || activeTrip?.city || route?.city_id || route?.city;

  useEffect(() => {
    let watcher = null;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Initial position
      const initial = await Location.getCurrentPositionAsync({});
      setVehiclePos({ lat: initial.coords.latitude, lon: initial.coords.longitude });

      // Start continuous watcher
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          const newPos = { lat: location.coords.latitude, lon: location.coords.longitude };
          setVehiclePos(newPos);
          setCurrentSpeed(Math.max(0, Math.round((location.coords.speed || 0) * 3.6)));

          // Send to backend via WebSocket if connected
          if (sendRef.current) {
            sendRef.current("location_update", {
              trip_id: tripId,
              lat: newPos.lat,
              lon: newPos.lon,
            });
          }
        },
      );
    };

    startTracking();

    return () => {
      if (watcher) {
        watcher.remove();
      }
    };
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return undefined;

    const poll = async () => {
      try {
        const data = await getNextStops(tripId);
        const stops = Array.isArray(data) ? data : data?.results || data?.stops || [];
        setNextStops(stops);
      } catch {
        setNextStops([]);
      }
    };

    poll();
    const timer = setInterval(poll, 15000);

    return () => clearInterval(timer);
  }, [tripId]);

  const vehicleId = activeTrip?.vehicle_id || activeTrip?.bus_id || tripId;

  const handleWsMessage = useCallback((data) => {
    if (data.type === "student_update" || data.type === "passenger_update") {
      setPassengers((prev) => ({
        ...prev,
        [data.user_id]: {
          user_id: data.user_id,
          lat: data.lat,
          lon: data.lon,
          hand_raised: data.hand_raised,
        },
      }));
    }

    if (data.type === "passenger_stopped") {
      setPassengers((prev) => {
        const next = { ...prev };
        delete next[data.user_id];
        return next;
      });
    }
  }, []);

  const { send, connectionState } = useWebSocket(
    vehicleId ? WS.trackingVehicle(vehicleId) : null,
    {
      enabled: !!vehicleId,
      onMessage: handleWsMessage,
    },
  );

  sendRef.current = send;

  useEffect(() => {
    setWsStatus(connectionState);
  }, [connectionState]);

  if (!route || !activeTrip) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Text style={styles.warning}>!</Text>
        <Text style={styles.errorTitle}>Live trip data unavailable</Text>
        <VayyButton label="Return to Review" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const vehicleCoord = toCoord(vehiclePos);
  const routeCoords = summary.stops.map(toCoord).filter(Boolean);
  const initial = vehicleCoord || routeCoords[0] || { latitude: 28.6139, longitude: 77.209 };
  const nextStop = nextStops[0] || summary.stops[1] || summary.stops[0];
  const passengerList = Object.values(passengers);

  return (
    <View style={styles.root}>
      <VayyMap
        ref={mapRef}
        initialRegion={{ ...initial, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        style={styles.map}
      >
        {routeCoords.length > 1 ? (
          <GeoJSONSource
            id="route-line"
            data={{
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: routeCoords.map((c) => [c.longitude, c.latitude]),
              },
            }}
          >
            <Layer
              id="route-line-layer"
              type="line"
              paint={{
                "line-color": COLORS.primary,
                "line-width": 5,
                "line-cap": "round",
                "line-join": "round",
              }}
            />
          </GeoJSONSource>
        ) : null}
        <ViewAnnotation id="vehicle-marker" lngLat={vehicleCoord ? [vehicleCoord.longitude, vehicleCoord.latitude] : [0, 0]} anchor="center">
          <View style={[styles.vehicleMarker, { opacity: vehicleCoord ? 1 : 0 }]}>
            <LiveDot size={13} />
            <VehicleIconBadge size={38} vehicleType={activeTrip?.vehicle_type || "auto"} />
          </View>
        </ViewAnnotation>
        {passengerList.map((passenger) => {
          const coord = toCoord(passenger);
          if (!coord) return null;
          return (
            <ViewAnnotation
              key={passenger.user_id}
              id={`passenger-${passenger.user_id}`}
              lngLat={[coord.longitude, coord.latitude]}
              anchor="center"
            >
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.warning, borderWidth: 2, borderColor: "#fff" }} />
            </ViewAnnotation>
          );
        })}
      </VayyMap>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.vehicleTitle}>
              {activeTrip?.route_code || activeTrip?.vehicle_number || summary.vehicleNumber || "VAYY Vehicle"}
            </Text>
            <Text style={styles.routeName}>{summary.title}</Text>
          </View>
          <View style={styles.onTime}>
            <Text style={styles.onTimeText}>On Time</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.panel}>
        <Text style={styles.panelLabel}>Next Stop</Text>
        <Text style={styles.nextStop}>{nextStop?.name || nextStop?.stop_name || "—"}</Text>
        <Text style={styles.distance}>{nextStop?.distance || "—"}</Text>

        <View style={styles.etaRow}>
          <Text style={styles.etaNumber}>{nextStop?.eta || nextStop?.eta_minutes || "—"}</Text>
          <Text style={styles.etaUnit}>min</Text>
        </View>

        <View style={styles.stats}>
          <View>
            <Text style={styles.statValue}>{passengerList.length}</Text>
            <Text style={styles.statLabel}>Boarded</Text>
          </View>
          <View>
            <Text style={styles.statValue}>{currentSpeed}</Text>
            <Text style={styles.statLabel}>Speed</Text>
          </View>
          <View>
            <Text style={styles.statValue}>{nextStop?.traffic || "—"}</Text>
            <Text style={styles.statLabel}>Traffic</Text>
          </View>
        </View>

        <VayyButton fullWidth label="Start Announcement" onPress={() => {}} />
        <VayyButton fullWidth label="Call Control Room" onPress={() => {}} variant="outline" />
        <VayyButton fullWidth label="Report Issue" onPress={() => {}} variant="outline" />

        <VayyButton fullWidth label="End Trip" onPress={() => navigation.navigate("DriverTabs", { screen: "DriverModeSelect" })} variant="primary" />
      </View>

      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  errorScreen: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    flex: 1,
    gap: SPACING.base,
    justifyContent: "center",
    padding: SPACING.xl,
  },
  warning: { color: COLORS.error, fontSize: 50, fontWeight: "900" },
  errorTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  overlay: {
    bottom: 0,
    left: 0,
    pointerEvents: "box-none",
    position: "absolute",
    right: 0,
    top: 0,
  },
  headerCard: {
    ...SHADOW.md,
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    margin: SPACING.base,
    padding: SPACING.base,
  },
  vehicleTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  routeName: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  onTime: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  onTimeText: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  vehicleMarker: { alignItems: "center", justifyContent: "center" },
  panel: {
    ...SHADOW.md,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    bottom: 0,
    gap: SPACING.md,
    left: 0,
    padding: SPACING.base,
    position: "absolute",
    right: 0,
  },
  panelLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  nextStop: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  distance: { color: COLORS.textMuted, fontSize: 13 },
  etaRow: { alignItems: "baseline", flexDirection: "row", gap: SPACING.sm },
  etaNumber: { color: COLORS.primary, fontSize: 48, fontWeight: "900" },
  etaUnit: { color: COLORS.primary, fontSize: 18, fontWeight: "900" },
  stats: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: SPACING.md,
  },
  statValue: { color: COLORS.primary, fontSize: 18, fontWeight: "900", textAlign: "center" },
  statLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", textAlign: "center" },
  wsText: { color: COLORS.textMuted, fontSize: 11, textAlign: "center" },
  zoomButtons: {
    gap: SPACING.sm,
    position: "absolute",
    right: SPACING.base,
    top: 120,
  },
  zoomButton: {
    ...SHADOW.sm,
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  zoomText: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
});
