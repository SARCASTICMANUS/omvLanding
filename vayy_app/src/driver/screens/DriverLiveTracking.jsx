import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import BusIconBadge from "../../shared/components/common/BusIconBadge";
import LiveDot from "../../shared/components/common/LiveDot";
import VayyButton from "../../shared/components/common/VayyButton";
import api, { getWsUrl } from "../../shared/lib/api";
import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SHADOW from "../../shared/constants/shadow";
import SPACING from "../../shared/constants/spacing";
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
  const [busPos, setBusPos] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [nextStops, setNextStops] = useState([]);
  const [passengers, setPassengers] = useState({});
  const [wsStatus, setWsStatus] = useState("connecting");
  const [isDriving, setIsDriving] = useState(true);
  const ws = useRef(null);

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
      setBusPos({ lat: initial.coords.latitude, lon: initial.coords.longitude });

      // Start continuous watcher
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          const newPos = { lat: location.coords.latitude, lon: location.coords.longitude };
          setBusPos(newPos);
          setCurrentSpeed(Math.max(0, Math.round((location.coords.speed || 0) * 3.6)));

          // Send to backend via WebSocket if connected
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(
              JSON.stringify({
                type: "location_update",
                trip_id: tripId,
                lat: newPos.lat,
                lon: newPos.lon,
              }),
            );
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
        const res = await api.get(`/api/trips/next-stops/${tripId}/`);
        const data = Array.isArray(res.data) ? res.data : res.data?.results || res.data?.stops || [];
        setNextStops(data);
      } catch {
        setNextStops([]);
      }
    };

    poll();
    const timer = setInterval(poll, 15000);

    return () => clearInterval(timer);
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !cityId) return undefined;

    let mounted = true;

    const connect = async () => {
      const token =
        (await AsyncStorage.getItem("token")) ||
        (await AsyncStorage.getItem("access_token"));
      const url = getWsUrl(`/ws/public/${cityId}/driver/${tripId}/?token=${token || ""}`);

      if (!mounted) return;

      ws.current = new WebSocket(url);
      ws.current.onopen = () => setWsStatus("connected");
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

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
      };
      ws.current.onclose = () => setWsStatus("disconnected");
    };

    connect();

    return () => {
      mounted = false;
      ws.current?.close();
    };
  }, [cityId, tripId]);

  if (!route || !activeTrip) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Text style={styles.warning}>!</Text>
        <Text style={styles.errorTitle}>Live trip data unavailable</Text>
        <VayyButton label="Return to Review" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const busCoord = toCoord(busPos);
  const routeCoords = summary.stops.map(toCoord).filter(Boolean);
  const initial = busCoord || routeCoords[0] || { latitude: 28.6139, longitude: 77.209 };
  const nextStop = nextStops[0] || summary.stops[1] || summary.stops[0];
  const passengerList = Object.values(passengers);

  return (
    <View style={styles.root}>
      <MapView
        initialRegion={{ ...initial, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        style={styles.map}
      >
        {routeCoords.length > 1 ? (
          <Polyline coordinates={routeCoords} strokeColor={COLORS.primary} strokeWidth={5} />
        ) : null}
        {busCoord ? (
          <Marker coordinate={busCoord}>
            <View style={styles.busMarker}>
              <LiveDot size={13} />
              <BusIconBadge size={38} />
            </View>
          </Marker>
        ) : null}
        {passengerList.map((passenger) => {
          const coord = toCoord(passenger);
          if (!coord) return null;
          return <Marker key={passenger.user_id} coordinate={coord} pinColor={COLORS.warning} />;
        })}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.busTitle}>
              Bus {activeTrip?.vehicle_number || activeTrip?.bus_number || summary.vehicleNumber || "VAYY 1024"}
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
        <Text style={styles.nextStop}>{nextStop?.name || nextStop?.stop_name || "Next stop"}</Text>
        <Text style={styles.distance}>2.1 km away</Text>

        <View style={styles.etaRow}>
          <Text style={styles.etaNumber}>6</Text>
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
            <Text style={styles.statValue}>Low</Text>
            <Text style={styles.statLabel}>Traffic</Text>
          </View>
        </View>

        <VayyButton fullWidth label="Start Announcement" onPress={() => {}} />
        <VayyButton fullWidth label="Call Control Room" onPress={() => {}} variant="outline" />
        <VayyButton fullWidth label="Report Issue" onPress={() => {}} variant="outline" />

        <VayyButton fullWidth label="End Trip" onPress={() => navigation.navigate("DriverModeSelect")} variant="primary" />
      </View>

      <View style={styles.zoomButtons}>
        <TouchableOpacity style={styles.zoomButton}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton}>
          <Text style={styles.zoomText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton}>
          <Text style={styles.zoomText}>o</Text>
        </TouchableOpacity>
      </View>
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
  busTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
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
  busMarker: { alignItems: "center", justifyContent: "center" },
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
