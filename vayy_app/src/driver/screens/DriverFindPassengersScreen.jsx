import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getNearbyPassengers } from "../services/driverService";
import VayyMap, { ViewAnnotation, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import { DEFAULT_CENTER } from "../../constants/mapConfig";
import COLORS from "../../shared/constants/colors";
import { WS } from "../../constants";
import { buildRouteSummary } from "../utils/driverFlowUtils";
import useWebSocket from "../../shared/hooks/useWebSocket";
import ZoomControls from "../../shared/components/common/ZoomControls";

const INITIAL_FETCH_DONE = "initial_fetch_done";

export default function DriverFindPassengersScreen({ navigation, route: routeProp }) {
  const selectedRoute = routeProp?.params?.route;
  const mode = selectedRoute?.mode || "bike";
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [meta, setMeta] = useState(null);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const passengersRef = useRef([]);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const initialFetchDoneRef = useRef(false);

  const summary = selectedRoute ? buildRouteSummary(selectedRoute) : null;
  const routeId = selectedRoute?.id;

  // Initial HTTP fetch to get existing passengers
  const fetchPassengers = useCallback(async () => {
    if (!routeId) return;
    try {
      const response = await getNearbyPassengers(routeId);
      const data = response?.data ?? [];
      const metaInfo = response?.meta ?? null;
      setPassengers(data);
      passengersRef.current = data;
      setMeta(metaInfo);
      initialFetchDoneRef.current = true;
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch passengers:", error);
      setLoading(false);
    }
  }, [routeId]);

  // WebSocket for real-time passenger updates
  const handleWsMessage = useCallback((msg) => {
    if (msg.event === "passenger_location") {
      setPassengers((prev) => {
        const idx = prev.findIndex((p) => p.id === msg.user_id);
        const updated = {
          id: msg.user_id,
          name: msg.display_name,
          avatar: (msg.display_name || "P")[0].toUpperCase(),
          lat: msg.lat,
          lon: msg.lng,
          near_stop: msg.near_stop || "",
          distance_to_stop_m: msg.distance_to_stop_m || 0,
          wants_route: true,
          hand_raised: idx >= 0 ? prev[idx].hand_raised : false,
          last_active: new Date().toISOString(),
        };

        let next;
        if (idx >= 0) {
          next = [...prev];
          next[idx] = updated;
        } else {
          next = [...prev, updated];
        }
        passengersRef.current = next;

        if (initialFetchDoneRef.current) {
          setMeta((m) => m ? { ...m, passengers_found: next.length } : m);
        }

        return next;
      });
    } else if (msg.event === "passenger_left") {
      setPassengers((prev) => {
        const next = prev.filter((p) => p.id !== msg.user_id);
        passengersRef.current = next;
        if (initialFetchDoneRef.current) {
          setMeta((m) => m ? { ...m, passengers_found: next.length } : m);
        }
        return next;
      });
    } else if (msg.type === "boarding_update") {
      // Handle hand raise/lower from boarding request
      const userId = msg.user_id;
      const handRaised = msg.hand_raised;

      setPassengers((prev) => {
        const idx = prev.findIndex((p) => p.id === userId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], hand_raised: handRaised };
          passengersRef.current = next;
          return next;
        }

        // Passenger not yet in list — add them with hand_raised flag
        const newPassenger = {
          id: userId,
          name: msg.passenger_name || "Passenger",
          avatar: (msg.passenger_name || "P")[0].toUpperCase(),
          lat: null,
          lon: null,
          near_stop: msg.pickup_stop_name || "",
          distance_to_stop_m: 0,
          wants_route: true,
          hand_raised: handRaised,
          boarding_request_id: msg.boarding_request_id,
          last_active: new Date().toISOString(),
        };
        const next = [...prev, newPassenger];
        passengersRef.current = next;

        if (initialFetchDoneRef.current) {
          setMeta((m) => m ? { ...m, passengers_found: next.length } : m);
        }

        return next;
      });
    }
  }, []);

  const wsPath = routeId ? WS.routePassengers(routeId) : null;
  const { connectionState } = useWebSocket(wsPath, {
    onMessage: handleWsMessage,
    enabled: !!routeId,
  });

  // Initial fetch on mount
  useEffect(() => {
    fetchPassengers();
  }, [fetchPassengers]);

  const didFitRef = useRef(false);

  const fitRoute = useCallback((stops, cam) => {
    const coords = stops
      .filter((s) => typeof s.lat === "number" && typeof s.lon === "number")
      .map((s) => [s.lon, s.lat]);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      cam.setStop({ center: coords[0], zoom: 14, duration: 500 });
      return;
    }
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    cam.fitBounds(
      [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      { padding: { top: 80, right: 160, bottom: 80, left: 160 }, duration: 500 },
    );
  }, []);

  // Fit map to show route on mount — retry until cameraRef is available
  useEffect(() => {
    if (didFitRef.current || !summary?.stops) return;

    const tryFit = (attempt) => {
      if (didFitRef.current) return;
      if (!cameraRef.current) {
        if (attempt < 10) setTimeout(() => tryFit(attempt + 1), 200);
        return;
      }
      didFitRef.current = true;
      fitRoute(summary.stops, cameraRef.current);
    };

    tryFit(0);
  }, [summary]);

  const routeCoords = summary?.stops
    ?.filter((s) => typeof s.lat === "number" && typeof s.lon === "number")
    ?.map((s) => [s.lon, s.lat]) || [];

  const onPassengerSelect = (p) => {
    setSelectedPassenger(p);
    if (cameraRef.current && p.lat && p.lon) {
      cameraRef.current.setStop({
        center: [p.lon, p.lat],
        zoom: 15,
        duration: 400,
      });
    }
  };

  const onAcceptPassenger = (p) => {
    if (mode === "auto") {
      navigation.navigate("AutoFindPassenger", {
        route: selectedRoute,
        acceptedPassenger: p,
      });
    } else {
      navigation.navigate("FindPassenger", {
        route: selectedRoute,
        acceptedPassenger: p,
      });
    }
  };

  const renderPassenger = ({ item }) => (
    <TouchableOpacity
      style={[styles.passengerCard, selectedPassenger?.id === item.id && styles.passengerCardActive]}
      onPress={() => onPassengerSelect(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.passengerAvatar, item.hand_raised && styles.passengerAvatarHandRaised]}>
        {item.hand_raised ? (
          <Text style={styles.handEmojiSmall}>✋</Text>
        ) : (
          <Text style={styles.passengerAvatarText}>{item.avatar}</Text>
        )}
      </View>
      <View style={styles.passengerInfo}>
        <Text style={styles.passengerName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.passengerStop} numberOfLines={1}>
          Near {item.near_stop} ({item.distance_to_stop_m}m)
        </Text>
        {item.hand_raised && (
          <Text style={styles.handRaisedLabel}>Hand Raised — wants to board</Text>
        )}
      </View>
      {item.hand_raised ? (
        <View style={styles.handRaisedBadge}>
          <Text style={styles.handRaisedBadgeText}>✋</Text>
        </View>
      ) : item.wants_route ? (
        <View style={styles.wantsRouteBadge}>
          <Ionicons name="arrow-forward" size={12} color="#fff" />
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      {/* Map */}
      <VayyMap
        ref={mapRef}
        cameraRef={cameraRef}
        style={styles.map}
        initialViewState={{
          center: [
            summary?.startCoord?.longitude || DEFAULT_CENTER.longitude,
            summary?.startCoord?.latitude || DEFAULT_CENTER.latitude,
          ],
          zoom: 14,
        }}
      >
        {routeCoords.length > 1 && (
          <GeoJSONSource
            id="route-line"
            data={{
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: routeCoords,
              },
            }}
          >
            <Layer
              id="route-line-layer"
              type="line"
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
              paint={{
                "line-color": COLORS.primary,
                "line-width": 4,
              }}
            />
          </GeoJSONSource>
        )}

        {summary?.stops?.filter((s) => typeof s.lat === "number" && typeof s.lon === "number").map((stop, i) => (
          <ViewAnnotation
            key={`stop-${stop.id || i}`}
            id={`stop-${stop.id || i}`}
            lngLat={[stop.lon, stop.lat]}
          >
            <View style={styles.stopMarker}>
              <Text style={styles.stopMarkerText}>{i + 1}</Text>
            </View>
          </ViewAnnotation>
        ))}

        {passengers
          .filter((p) => typeof p.lat === "number" && typeof p.lon === "number")
          .map((p) => (
            <ViewAnnotation
              key={`p-${p.id}`}
              id={`p-${p.id}`}
              lngLat={[p.lon, p.lat]}
              onSelect={() => onPassengerSelect(p)}
            >
              <View style={[
                styles.passengerMarker,
                p.hand_raised && styles.passengerMarkerHandRaised,
                p.wants_route && !p.hand_raised && styles.passengerMarkerWants,
              ]}>
                <Text style={[styles.handEmoji, !p.hand_raised && { display: "none" }]}>✋</Text>
                <Ionicons name="person" size={14} color="#fff" style={p.hand_raised && { display: "none" }} />
              </View>
            </ViewAnnotation>
          ))}
      </VayyMap>

      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

      {/* Header */}
      <SafeAreaView edges={["top"]} pointerEvents="box-none" style={styles.headerWrap}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerMid}>
            <Text style={styles.headerTitle}>
              {summary?.title || "Find Passengers"}
            </Text>
            <Text style={styles.headerSub}>
              {meta ? `${meta.passengers_found} passenger${meta.passengers_found !== 1 ? "s" : ""} nearby` : "Loading..."}
            </Text>
          </View>
          <View style={styles.wsIndicator}>
            <View style={[styles.wsDot, connectionState === "connected" && styles.wsDotConnected]} />
          </View>
        </View>
      </SafeAreaView>

      {/* Passenger list bottom sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>Nearby Passengers</Text>

        {loading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Searching for passengers...</Text>
          </View>
        ) : passengers.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="people-outline" size={32} color="#D1D5DB" />
            <Text style={styles.stateText}>No passengers found nearby</Text>
            <Text style={styles.stateSub}>Start your radar to receive ride requests in real-time</Text>
            <TouchableOpacity
              style={styles.startRadarBtn}
              onPress={() => {
                if (mode === "auto") {
                  navigation.navigate("AutoFindPassenger", { route: selectedRoute });
                } else {
                  navigation.navigate("FindPassenger", { route: selectedRoute });
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="radio" size={18} color="#fff" />
              <Text style={styles.startRadarBtnText}>Start Radar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={passengers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderPassenger}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Accept button */}
        {selectedPassenger && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => onAcceptPassenger(selectedPassenger)}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.acceptBtnText}>
              Pick Up {selectedPassenger.name}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },

  /* header */
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  headerMid: { flex: 1, marginLeft: 12 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "500", marginTop: 1 },

  /* ws indicator */
  wsIndicator: { marginLeft: 8, alignItems: "center", justifyContent: "center" },
  wsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  wsDotConnected: { backgroundColor: "#00E676" },

  /* markers */
  stopMarker: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  stopMarkerText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  passengerMarker: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F59E0B",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  passengerMarkerHandRaised: {
    backgroundColor: "#F59E0B",
    width: 40, height: 40, borderRadius: 20,
  },
  passengerMarkerWants: {
    backgroundColor: COLORS.primary,
  },
  handEmoji: { fontSize: 18 },
  handEmojiSmall: { fontSize: 16 },

  /* bottom sheet */
  bottomSheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: "45%",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 15,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB", alignSelf: "center", marginTop: 10, marginBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 12 },
  listContent: { paddingBottom: 8 },

  /* passenger card */
  passengerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#F9FAFB", borderRadius: 14, padding: 12, marginBottom: 8,
  },
  passengerCardActive: {
    backgroundColor: "#ECFDF5", borderWidth: 1.5, borderColor: COLORS.primary,
  },
  passengerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center",
  },
  passengerAvatarHandRaised: {
    backgroundColor: "#FEF3C7",
  },
  passengerAvatarText: { fontSize: 16, fontWeight: "800", color: "#374151" },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  passengerStop: { fontSize: 12, color: "#6B7280", fontWeight: "500", marginTop: 2 },
  handRaisedLabel: { fontSize: 11, color: "#D97706", fontWeight: "700", marginTop: 2 },
  handRaisedBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center",
  },
  wantsRouteBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },

  /* state */
  stateCard: { alignItems: "center", paddingVertical: 24, gap: 8 },
  stateText: { fontSize: 14, fontWeight: "600", color: "#9CA3AF" },
  stateSub: { fontSize: 12, color: "#D1D5DB", textAlign: "center" },
  startRadarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  startRadarBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  /* accept button */
  acceptBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 14,
    marginTop: 12,
  },
  acceptBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
