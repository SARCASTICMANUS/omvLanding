import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
export function formatEtaMinutes(etaSeconds) {
  return Math.max(1, Math.ceil(Number(etaSeconds || 300) / 60));
}

export function formatWalkText(meters) {
  if (!meters || meters <= 0) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m walk`;
  return `${(meters / 1000).toFixed(1)} km walk`;
}

export function shortPlace(point, fallback) {
  return (
    point?.name ||
    point?.display_name?.split(",")?.[0] ||
    point?.address ||
    fallback
  );
}

/* ─────────────────────────────────────────────
   STOP CONNECTOR COMPONENT
───────────────────────────────────────────── */
function StopDotLine({ pickupLabel, dropLabel, firstMileWalk, lastMileWalk }) {
  return (
    <View style={s.dotWrap}>
      {/* Pickup Row */}
      <View style={s.dotRow}>
        <View style={s.dotGreen} />
        <View style={{ flex: 1 }}>
          <Text style={s.stopName} numberOfLines={1}>{pickupLabel}</Text>
          <Text style={s.stopSub}>
            Pickup{firstMileWalk ? `  •  ${formatWalkText(firstMileWalk)}` : ""}
          </Text>
        </View>
      </View>

      {/* Dashed Connector */}
      <View style={s.connectorWrap}>
        <View style={s.connectorLine} />
      </View>

      {/* Dropoff Row */}
      <View style={s.dotRow}>
        <View style={s.dotOrange} />
        <View style={{ flex: 1 }}>
          <Text style={s.stopName} numberOfLines={1}>{dropLabel}</Text>
          <Text style={s.stopSub}>
            Drop-off{lastMileWalk ? `  •  ${formatWalkText(lastMileWalk)}` : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   PASSENGER ROUTE CARD
───────────────────────────────────────────── */
function RouteCard({ trip, pickup, destination, isBest, index, onPress, onToggleExpand, expanded }) {
  const routeCode   = trip?.route_code || `R-${index + 1}`;
  const routeName   = trip?.name || "Transit Route";
  
  const boardingStop  = trip?.pickup_stop;
  const alightingStop = trip?.dropoff_stop;
  
  const boardLabel  = boardingStop?.name || shortPlace(pickup, "Pickup Point");
  const alightLabel = alightingStop?.name || shortPlace(destination, "Drop-off Point");

  const firstMileWalk = trip?.first_mile_walk_meters || boardingStop?.distance_meters || 0;
  const lastMileWalk  = trip?.last_mile_walk_meters || alightingStop?.distance_to_destination_meters || 0;
  
  const fare     = trip?.fare ?? "—";
  const distKm   = trip?.distance_km ? `${trip.distance_km} km` : "—";
  const etaMin   = formatEtaMinutes(trip?.eta_seconds);
  const stops    = trip?.stops || [];

  return (
    <View style={[s.card, isBest && s.cardBest]}>
      {/* BEST MATCH BADGE */}
      {isBest && (
        <View style={s.bestBadge}>
          <Ionicons name="sparkles" size={12} color="#fff" style={{ marginRight: 4 }} />
          <Text style={s.bestBadgeText}>BEST MATCH</Text>
        </View>
      )}

      <TouchableOpacity activeOpacity={0.92} onPress={() => onPress?.(trip)}>
        <View style={s.mainRow}>
          {/* ROUTE CODE BADGE */}
          <View style={s.routeNumWrap}>
            <View style={[s.routeNumBadge, isBest && s.routeNumBadgeBest]}>
              <Text style={s.routeNumText}>{routeCode}</Text>
            </View>
          </View>

          {/* MAIN STOP TIMELINE */}
          <View style={{ flex: 1 }}>
            <Text style={s.routeTitle} numberOfLines={1}>{routeName}</Text>
            <StopDotLine
              dropLabel={alightLabel}
              firstMileWalk={firstMileWalk}
              lastMileWalk={lastMileWalk}
              pickupLabel={boardLabel}
            />
          </View>

          {/* FARE & PRICE COL */}
          <View style={s.rightCol}>
            <View style={[s.statsBox, isBest && s.statsBoxBest]}>
              <Text style={[s.statsNum, isBest && s.statsNumBest]}>₹{fare}</Text>
              <Text style={s.statsLabel}>Est. Fare</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* METRICS & ACTIONS */}
      <View style={s.cardBottom}>
        <View style={s.metricsRow}>
          <View style={s.metric}>
            <Ionicons name="walk-outline" size={14} color="#009849" />
            <Text style={s.metricText}>{formatWalkText(firstMileWalk + lastMileWalk)}</Text>
          </View>
          <Text style={s.metricSep}>•</Text>
          <View style={s.metric}>
            <Ionicons name="navigate-outline" size={14} color="#6B7280" />
            <Text style={s.metricText}>{distKm}</Text>
          </View>
          <Text style={s.metricSep}>•</Text>
          <View style={s.metric}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={s.metricText}>{etaMin} min total</Text>
          </View>
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.viewStopsBtn}
            onPress={() => onToggleExpand(trip?.id || index)}
          >
            <Text style={s.viewStopsText}>
              {expanded ? "Hide Stops" : `Stops (${stops.length}) ›`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.selectBtn, isBest && s.selectBtnBest]}
            onPress={() => onPress?.(trip)}
          >
            <Text style={s.selectBtnText}>Select Route</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* EXPANDABLE STOPS LIST */}
      {expanded && stops.length > 0 && (
        <View style={s.stopsPanel}>
          {stops.map((stop, si) => {
            const isBoarding  = boardingStop?.id ? String(stop.id) === String(boardingStop.id) : si === 0;
            const isAlighting = alightingStop?.id ? String(stop.id) === String(alightingStop.id) : si === stops.length - 1;

            let badgeBg = "#E5E7EB";
            let textColor = "#374151";
            let statusText = "On Route";

            if (isBoarding) {
              badgeBg = "#009849";
              textColor = "#009849";
              statusText = "Board Here";
            } else if (isAlighting) {
              badgeBg = "#F59E0B";
              textColor = "#F59E0B";
              statusText = "Alight Here";
            }

            return (
              <View key={stop.id || si} style={s.stopRow}>
                <View style={[s.stopSeq, { backgroundColor: badgeBg }]}>
                  <Text style={[s.stopSeqText, (isBoarding || isAlighting) && { color: "#fff" }]}>
                    {stop.order || si + 1}
                  </Text>
                </View>
                <View style={s.stopDetail}>
                  <Text style={s.stopListStopName}>{stop.name}</Text>
                  <Text style={[s.stopStatus, { color: textColor }]}>{statusText}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────
   MAIN SCREEN EXPORT
───────────────────────────────────────────── */
export default function PassengerRouteList({ navigation, route }) {
  const {
    trips = [],
    loading = false,
    pickup: initialPickup,
    destination: initialDestination,
    mode = "auto",
  } = route?.params || {};

  const isBike = mode === "bike";
  const accent = "#009849";
  const pickup = initialPickup;
  const destination = initialDestination;
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  /* UPDATED BEST MATCH SORTING LOGIC:
     Prioritize lowest total walk distance first, followed by lower ETA and fare. */
  const sortedTrips = useMemo(() => {
    if (!Array.isArray(trips)) return [];
    return [...trips].sort((a, b) => {
      const walkA = a.walk_distance_meters ?? (a.first_mile_walk_meters + a.last_mile_walk_meters) ?? 0;
      const walkB = b.walk_distance_meters ?? (b.first_mile_walk_meters + b.last_mile_walk_meters) ?? 0;
      
      if (walkA !== walkB) return walkA - walkB;
      if (a.eta_seconds !== b.eta_seconds) return (a.eta_seconds || 0) - (b.eta_seconds || 0);
      return (a.fare || 0) - (b.fare || 0);
    });
  }, [trips]);

  const handleContinue = (selectedTrip) => {
    if (!selectedTrip) return;
    const targetScreen = mode === "bike" ? "BikeMapPreRide" : "AutoPreRide";
    navigation.navigate(targetScreen, { trip: selectedTrip, pickup, destination, mode });
  };

  const routeCount = sortedTrips.length;

  const renderItem = ({ item, index }) => (
    <RouteCard
      destination={destination}
      expanded={String(expandedRouteId) === String(item?.id || index)}
      index={index}
      isBest={index === 0}
      onPress={handleContinue}
      onToggleExpand={(id) => setExpandedRouteId((cur) => (String(cur) === String(id) ? null : id))}
      pickup={pickup}
      trip={item}
    />
  );

  return (
    <SafeAreaView edges={["top"]} style={s.safe}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>

        <View style={s.headerMid}>
          <Text style={s.headerTitle}>Available Routes</Text>
          <Text style={[s.headerSub, { color: accent }]}>{isBike ? "Bike" : "Auto"} Transit</Text>
        </View>

        <TouchableOpacity style={s.iconBtn}>
          <Ionicons name="options-outline" size={18} color="#009849" />
        </TouchableOpacity>
      </View>

      {/* ROUTE LIST */}
      <FlatList
        contentContainerStyle={s.listContent}
        data={loading ? [] : sortedTrips}
        keyExtractor={(item, i) => String(item?.id || i)}
        ListHeaderComponent={() => (
          <>
            {!loading && routeCount > 0 && (
              <Text style={s.countText}>{routeCount} routes found for your journey</Text>
            )}
            {loading && (
              <View style={s.stateCard}>
                <Text style={s.stateText}>Finding best options...</Text>
              </View>
            )}
            {!loading && routeCount === 0 && (
              <View style={s.stateCard}>
                <Text style={s.stateText}>No transit routes found for this location.</Text>
              </View>
            )}
          </>
        )}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const s = StyleSheet.create({
  safe: { backgroundColor: "#F4F6F4", flex: 1 },
  listContent: { paddingBottom: 24, paddingHorizontal: 16, paddingTop: 4 },

  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconBtn: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
    ...CARD_SHADOW,
  },
  headerMid: { flex: 1, marginLeft: 12 },
  headerTitle: { color: "#111827", fontSize: 22, fontWeight: "800" },
  headerSub: { fontSize: 13, fontWeight: "700", marginTop: 1 },

  countText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 4,
  },

  /* Card Styles */
  card: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
    ...CARD_SHADOW,
  },
  cardBest: {
    borderColor: "#009849",
    borderWidth: 1.5,
  },

  bestBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#009849",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  mainRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  routeNumWrap: {
    alignItems: "center",
    paddingTop: 2,
  },
  routeNumBadge: {
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 42,
  },
  routeNumBadgeBest: {
    backgroundColor: "#009849",
  },
  routeNumText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  routeTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },

  rightCol: {
    alignItems: "flex-end",
  },
  statsBox: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
  },
  statsBoxBest: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
  },
  statsNum: { color: "#111827", fontSize: 16, fontWeight: "900" },
  statsNumBest: { color: "#009849" },
  statsLabel: { color: "#9CA3AF", fontSize: 9, fontWeight: "600", marginTop: 1 },

  /* Stop Timeline */
  dotWrap: { gap: 0, marginTop: 2 },
  dotRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  dotGreen: {
    borderColor: "#009849",
    borderRadius: 999,
    borderWidth: 2.5,
    height: 12,
    width: 12,
  },
  dotOrange: {
    borderColor: "#F59E0B",
    borderRadius: 999,
    borderWidth: 2.5,
    height: 12,
    width: 12,
  },
  stopName: { color: "#111827", fontSize: 13, fontWeight: "700" },
  stopSub: { color: "#6B7280", fontSize: 11, fontWeight: "500", marginTop: 1 },
  connectorWrap: { alignItems: "center", height: 16, justifyContent: "center", paddingLeft: 5 },
  connectorLine: {
    borderColor: "#D1D5DB",
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    height: 16,
  },

  /* Card Bottom */
  cardBottom: {
    borderColor: "#F3F4F6",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metricText: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "600",
  },
  metricSep: {
    color: "#D1D5DB",
    fontSize: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewStopsBtn: {
    borderColor: "#E5E7EB",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewStopsText: { color: "#374151", fontSize: 12, fontWeight: "700" },
  selectBtn: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  selectBtnBest: {
    backgroundColor: "#009849",
  },
  selectBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  /* Stops Panel */
  stopsPanel: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 10,
  },
  stopRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  stopSeq: {
    alignItems: "center",
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  stopSeqText: { color: "#374151", fontSize: 10, fontWeight: "800" },
  stopDetail: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stopListStopName: { color: "#111827", fontSize: 12, fontWeight: "600" },
  stopStatus: { fontSize: 11, fontWeight: "700" },

  stateCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 40,
  },
  stateText: { color: "#9CA3AF", fontSize: 14, fontWeight: "600" },
});