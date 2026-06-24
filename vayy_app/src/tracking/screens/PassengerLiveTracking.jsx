import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

const toMapCoord = (point) => {
  if (!point) return null;
  const lat = Number(point.lat ?? point.latitude);
  const lon = Number(point.lon ?? point.lng ?? point.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { latitude: lat, longitude: lon };
};

export default function PassengerLiveTracking({ navigation, route }) {
  const tripId = route?.params?.tripId;
  const [tripData, setTripIdData] = useState(null);
  const [busData, setBusData] = useState({ pos: null, eta: [] });
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [myPos, setMyPos] = useState(null);

  const ws = useRef(null);
  const markers = useRef({});

  useEffect(() => {
    const init = async () => {
      if (!tripId || tripId === "undefined") {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/api/passenger/trips/${tripId}/`);
        setTripIdData(res.data);
      } catch {
        setTripIdData(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [tripId]);

  useEffect(() => {
    const initLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setMyPos({ lat: location.coords.latitude, lon: location.coords.longitude });
    };

    initLocation();
  }, []);

  useEffect(() => {
    if (loading || !tripId || tripId === "undefined") return undefined;

    let isMounted = true;

    const connect = async () => {
      const token =
        (await AsyncStorage.getItem("token")) ||
        (await AsyncStorage.getItem("access_token"));
      const wsUrl = getWsUrl(`/ws/public/global/passenger/${tripId}/?token=${token || ""}`);

      if (!isMounted) return;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => setWsStatus("connected");
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "city_vehicle_update" || data.type === "vehicle_update") {
          setBusData({
            pos: [data.lat, data.lon],
            eta: data.next_stop_eta || [],
          });
        }
      };
      ws.current.onclose = () => setWsStatus("disconnected");
    };

    connect();

    return () => {
      isMounted = false;
      ws.current?.close();
    };
  }, [loading, tripId]);

  useEffect(() => {
    markers.current = {
      bus: busData.pos,
      me: myPos,
    };
  }, [busData.pos, myPos]);

  const busCoord = busData.pos
    ? { latitude: Number(busData.pos[0]), longitude: Number(busData.pos[1]) }
    : null;
  const myCoord = toMapCoord(myPos);
  const destinationCoord = useMemo(() => {
    const lastStop = tripData?.stops?.[tripData.stops.length - 1];
    return toMapCoord(lastStop);
  }, [tripData]);
  const routeCoords = useMemo(
    () =>
      [myCoord, busCoord, destinationCoord].filter(Boolean),
    [busCoord, destinationCoord, myCoord],
  );
  const initial = myCoord || busCoord || destinationCoord || { latitude: 28.6139, longitude: 77.209 };
  const etaMinutes = busData.eta?.[0]?.duration_seconds
    ? Math.ceil(busData.eta[0].duration_seconds / 60)
    : "--";

  const handleShareTrip = async () => {
    try {
      await Share.share({ message: `Track my trip on VAYY! Trip ID: ${tripId || "N/A"}` });
    } catch {}
  };

  const handleSOS = () => {
    Alert.alert(
      "SOS Emergency",
      "Emergency assistance has been notified. Stay calm, help is on the way.",
      [{ text: "OK", style: "default" }],
    );
  };

  const handleCallDriver = () => {
    const phone = tripData?.driver_phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert("Call Driver", "Driver contact number is not available yet.");
    }
  };

  const handleReportIssue = () => {
    Alert.alert(
      "Report Issue",
      "Please contact support at support@vayy.app or call +91-XXXXX-XXXXX.",
      [{ text: "OK" }],
    );
  };

  const handleOnBoard = () => {
    Alert.alert("Boarding Confirmed", "You are now on board! Enjoy your ride.");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <LiveDot size={14} />
        <Text style={styles.loadingText}>Syncing live trip data...</Text>
      </SafeAreaView>
    );
  }

  if (!tripId || tripId === "undefined" || !tripData) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Trip Not Found</Text>
        <VayyButton label="Go Back" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        initialRegion={{
          ...initial,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        style={styles.map}
      >
        {routeCoords.length > 1 ? (
          <Polyline coordinates={routeCoords} strokeColor={COLORS.primary} strokeWidth={4} />
        ) : null}

        {busCoord ? (
          <Marker coordinate={busCoord}>
            <View style={styles.busMarker}>
              <BusIconBadge size={34} />
            </View>
          </Marker>
        ) : null}

        {myCoord ? (
          <Marker coordinate={myCoord}>
            <View style={styles.userMarker} />
          </Marker>
        ) : null}

        {destinationCoord ? <Marker coordinate={destinationCoord} pinColor={COLORS.error} /> : null}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, wsStatus !== "connected" && styles.statusDotOff]} />
            <Text style={styles.statusText}>{wsStatus}</Text>
          </View>
        </View>

        <View style={styles.floatCard}>
          <Text style={styles.floatLabel}>Arriving in</Text>
          <Text style={styles.floatValue}>{etaMinutes} min</Text>
        </View>
      </SafeAreaView>

      <View style={styles.bottomSheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetTop}>
          <View>
            <Text style={styles.busTitle}>
              {tripData?.bus_number ? `Bus ${tripData.bus_number}` : "City Vehicle"}
            </Text>
            <Text style={styles.routeName}>{tripData?.route_name || "Active Route"}</Text>
          </View>
          <Text style={styles.etaText}>{etaMinutes} min</Text>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Boarding</Text>
          <View style={styles.progressLine} />
          <Text style={styles.progressText}>En Route</Text>
          <View style={styles.progressLineMuted} />
          <Text style={styles.progressText}>Drop-off</Text>
        </View>

        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>Stay alert! Your bus location updates live.</Text>
          <TouchableOpacity style={styles.alertButton}>
            <Text style={styles.alertButtonText}>Turn On Alerts</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          {[
            { label: "Share Trip", onPress: handleShareTrip },
            { label: "SOS", onPress: handleSOS },
            { label: "Call Driver", onPress: handleCallDriver },
            { label: "Report Issue", onPress: handleReportIssue },
          ].map(({ label, onPress }) => (
            <TouchableOpacity key={label} style={styles.actionButton} onPress={onPress}>
              <Text style={styles.actionText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <VayyButton fullWidth label="I'm on Board" onPress={handleOnBoard} size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerScreen: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    gap: SPACING.base,
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  errorIcon: {
    color: COLORS.error,
    fontSize: 44,
    fontWeight: "900",
  },
  errorTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  overlay: {
    bottom: 0,
    left: 0,
    pointerEvents: "box-none",
    position: "absolute",
    right: 0,
    top: 0,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: SPACING.base,
  },
  backButton: {
    ...SHADOW.sm,
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.full,
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  statusDot: {
    backgroundColor: COLORS.liveAccent,
    borderRadius: RADIUS.full,
    height: 8,
    width: 8,
  },
  statusDotOff: {
    backgroundColor: COLORS.error,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  floatCard: {
    ...SHADOW.md,
    alignSelf: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  floatLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  floatValue: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  busMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  userMarker: {
    backgroundColor: COLORS.liveAccent,
    borderColor: COLORS.white,
    borderRadius: RADIUS.full,
    borderWidth: 3,
    height: 18,
    width: 18,
  },
  bottomSheet: {
    ...SHADOW.md,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    bottom: 0,
    gap: SPACING.base,
    left: 0,
    padding: SPACING.base,
    paddingBottom: SPACING.xl,
    position: "absolute",
    right: 0,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: COLORS.borderMedium,
    borderRadius: RADIUS.full,
    height: 5,
    width: 44,
  },
  sheetTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  busTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  routeName: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  etaText: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  progressText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "800",
  },
  progressLine: {
    backgroundColor: COLORS.primary,
    flex: 1,
    height: 3,
  },
  progressLineMuted: {
    backgroundColor: COLORS.borderMedium,
    flex: 1,
    height: 3,
  },
  alertBanner: {
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: RADIUS.md,
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.md,
  },
  alertText: {
    color: COLORS.textSecondary,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  alertButton: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  alertButtonText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  actionButton: {
    backgroundColor: "#f9fafb",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  actionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
});
