import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import RoutePolylinePreview from "../components/RoutePolylinePreview";
import { getRouteStopLabels } from "../components/routePreviewUtils";

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
    point?.display_name ||
    fallback ||
    "Unknown"
  );
}

/* Walk distance without the trailing "walk" (used inside a longer sentence). */
function formatWalkDistance(meters) {
  const m = Number(meters) || 0;
  if (m <= 0) return "0 m";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/* Total walking distance for a trip; always a finite number (a missing
   first/last-mile field used to turn the sum into NaN and break sorting). */
function totalWalkMeters(trip) {
  const explicit = Number(trip?.walk_distance_meters);
  if (Number.isFinite(explicit)) return explicit;
  return (Number(trip?.first_mile_walk_meters) || 0) + (Number(trip?.last_mile_walk_meters) || 0);
}

/* Stable key for a trip: its id, or its position when it has none (a generated
   route has no persisted id yet). Used for expand state and the single map. */
function tripKey(trip, index) {
  return String(trip?.id || index);
}

/* ─────────────────────────────────────────────
   EXPANDED STOPS PANEL — same design as the driver stops panel
   ───────────────────────────────────────────── */
function StopsPanel({ stops, boardingStop, alightingStop }) {
  const ordered = useMemo(
    () => [...stops].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0)),
    [stops]
  );

  return (
    <View style={s.stopsPanel}>
      {ordered.map((stop, i) => {
        const isBoarding = boardingStop?.id != null
          ? String(stop?.id) === String(boardingStop.id)
          : boardingStop?.order != null
            ? Number(stop?.order) === Number(boardingStop.order)
            : i === 0;
        const isAlighting = alightingStop?.id != null
          ? String(stop?.id) === String(alightingStop.id)
          : alightingStop?.order != null
            ? Number(stop?.order) === Number(alightingStop.order)
            : i === ordered.length - 1;
        const dotColor = isBoarding ? "#009849" : isAlighting ? "#f59e0b" : "#D1D5DB";

        return (
          <View key={String(stop?.id ?? i)} style={s.stopTimelineRow}>
            <View style={s.stopTimelineCol}>
              <View style={[s.stopTimelineDot, { backgroundColor: dotColor }]} />
              {i < ordered.length - 1 && <View style={s.stopTimelineLine} />}
            </View>
            <View style={s.stopTimelineContent}>
              <Text style={s.stopTimelineName} numberOfLines={1}>{stop?.name || "Stop"}</Text>
              <Text style={s.stopTimelineEta}>Stop {stop?.order ?? i + 1}</Text>
            </View>
            {isBoarding && (
              <View style={s.boardingBadge}>
                <Text style={s.boardingBadgeText}>Boarding</Text>
              </View>
            )}
            {isAlighting && (
              <View style={s.alightBadge}>
                <Text style={s.alightBadgeText}>Alight</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ─────────────────────────────────────────────
   ROUTE CARD COMPONENT — same design as the driver RouteCard.
   Passenger data is unchanged: the fare is what the rider pays, walking
   distances are shown, and the CTA still selects the route.

   `showMap` is true for exactly ONE card at a time (see the screen below).
   RoutePolylinePreview is documented as "mount only while its card is shown":
   every instance is a native GL surface, and mounting one per FlatList row is
   what broke map rendering on this screen.
   ───────────────────────────────────────────── */
function RouteCard({ trip, pickup, destination, isBest, index, onPress, onToggleExpand, expanded, showMap }) {
  const routeCode = trip?.route_code;
  const routeName = trip?.name || "Transit Route";

  const boardingStop  = trip?.pickup_stop;
  const alightingStop = trip?.dropoff_stop;

  const { pickupLabel: startLabel, dropoffLabel: endLabel } = getRouteStopLabels({
    trip,
    pickup,
    destination,
  });

  const firstMileWalk = trip?.first_mile_walk_meters || boardingStop?.distance_meters || 0;
  const lastMileWalk  = trip?.last_mile_walk_meters || alightingStop?.distance_to_destination_meters || 0;
  const walkMicrocopy =
    trip?.walking_directions_available && ((Number(firstMileWalk) || 0) > 0 || (Number(lastMileWalk) || 0) > 0)
      ? `Walk to pickup ${formatWalkDistance(firstMileWalk)} · Walk from drop-off ${formatWalkDistance(lastMileWalk)}`
      : trip?.generated_from_global_stops && trip?.first_mile_proximity_meters != null
        ? `Nearest start stop ${formatWalkDistance(trip.first_mile_proximity_meters)} away (straight-line estimate)`
        : null;

  const fareText = trip?.fare != null ? `₹${trip.fare}` : "--";
  const distText = trip?.distance_km ? `${trip.distance_km} km` : "--";
  const etaText  = trip?.eta_seconds != null ? `${formatEtaMinutes(trip.eta_seconds)} min` : "ETA unavailable";
  const stops    = trip?.stops || [];
  const key      = tripKey(trip, index);

  return (
    <View style={[s.card, isBest && s.cardBest]}>
      {/* BEST MATCH + route code + route name */}
      <View style={s.bestRow}>
        {isBest && (
          <View style={s.bestBadge}>
            <Text style={s.bestBadgeText}>BEST MATCH</Text>
          </View>
        )}
        {routeCode ? (
          <View style={s.routeCodeBadge}>
            <Text style={s.routeCodeText}>{routeCode}</Text>
          </View>
        ) : null}
        <Text numberOfLines={1} style={s.routeNameText}>{routeName}</Text>
      </View>

      {/* Route visualization — start & end (tap to select) */}
      <TouchableOpacity activeOpacity={0.93} onPress={() => onPress?.(trip)}>
        <View style={s.routeRow}>
          <View style={s.routeNumCol}>
            <View style={s.routeNumBadge}>
              <Text style={s.routeNumText}>{index + 1}</Text>
            </View>
          </View>

          <View style={s.routeDetail}>
            <View style={s.stopRowItem}>
              <View style={s.dotGreen} />
              <Text numberOfLines={1} style={[s.stopNameText, s.stopNameBold, s.stopNameFlex]}>
                {startLabel}
              </Text>
            </View>
            <View style={s.connectorDashed} />
            <View style={s.stopRowItem}>
              <View style={s.dotOrange} />
              <Text numberOfLines={1} style={[s.stopNameText, s.stopNameBold, s.stopNameFlex]}>
                {endLabel}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Stats bar — ETA | Ride | Fare */}
      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Ionicons name="time-outline" size={15} color="#6B7280" />
          <View style={s.statTextCol}>
            <Text style={s.statValue}>{etaText}</Text>
            <Text style={s.statLabel}>ETA</Text>
          </View>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Ionicons name="speedometer" size={14} color="#6B7280" />
          <View style={s.statTextCol}>
            <Text style={s.statValue}>{distText}</Text>
            <Text style={s.statLabel}>Ride</Text>
          </View>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <View style={s.statTextCol}>
            <Text style={s.fareValue}>{fareText}</Text>
            <Text style={s.statLabel}>Est. Fare</Text>
          </View>
        </View>
      </View>

      {/* Walk microcopy */}
      {walkMicrocopy ? (
        <View style={s.walkRow}>
          <Ionicons name="walk-outline" size={13} color="#9CA3AF" />
          <Text style={s.walkText}>{walkMicrocopy}</Text>
        </View>
      ) : null}
      {/* Stops count + View Stops toggle */}
      <View style={s.stopsRow}>
        <View style={s.stopsCountBadge}>
          <Ionicons name="location-outline" size={13} color="#009849" />
          <Text style={s.stopsCountText}>{stops.length} stops</Text>
        </View>
        {stops.length > 0 && (
          <TouchableOpacity style={s.viewStopsBtn} onPress={() => onToggleExpand(key)}>
            <Text style={s.viewStopsText}>{expanded ? "Hide Stops" : "View Stops"}</Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color="#009849" />
          </TouchableOpacity>
        )}
      </View>

      {/* Route polyline preview — the existing component, mounted on one card
          at a time. It renders nothing when the route carries no geometry. */}
      {showMap ? (
        <View style={s.mapWrap}>
          <RoutePolylinePreview key={`preview-${key}`} route={trip} height={120} />
        </View>
      ) : null}

      {expanded && stops.length > 0 && (
        <StopsPanel
          stops={stops}
          boardingStop={boardingStop}
          alightingStop={alightingStop}
        />
      )}

      {/* CTA */}
      <TouchableOpacity
        style={s.continueBtn}
        onPress={() => onPress?.(trip)}
        activeOpacity={0.85}
      >
        <Text style={s.continueBtnText}>Select Route</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

/* ─────────────────────────────────────────────
   SCREEN COMPONENT
   ───────────────────────────────────────────── */
export default function PassengerRouteList({ navigation, route }) {
  const {
    trips = [],
    loading = false,
    pickup: initialPickup,
    destination: initialDestination,
    mode = "auto",
    emptyMessage = null,
  } = route?.params || {};

  const isBike = mode === "bike";
  const pickup = initialPickup;
  const destination = initialDestination;
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const [liveTrips, setLiveTrips] = useState(Array.isArray(trips) ? trips : []);
  const [searchError, setSearchError] = useState(null);
  const refreshMatchesRef = useRef(null);

  useEffect(() => {
    setLiveTrips(Array.isArray(trips) ? trips : []);
  }, [trips]);

  // This screen displays the OSRM-backed route preview generated by
  // PassengerTripPlanner. Do not replace it with live vehicle matches here:
  // matching happens after the rider reaches the pickup stop and raises a hand.
  useEffect(() => {
    setLiveTrips(Array.isArray(trips) ? trips : []);
    setSearchError(null);
  }, [trips]);

  /* BEST MATCH: lowest total walk first, then shorter ETA, then lower fare. */
  const sortedTrips = useMemo(() => {
    if (!Array.isArray(liveTrips)) return [];
    return [...liveTrips].sort((a, b) => {
      const walkA = totalWalkMeters(a);
      const walkB = totalWalkMeters(b);
      if (walkA !== walkB) return walkA - walkB;
      const etaA = Number(a?.eta_seconds) || 0;
      const etaB = Number(b?.eta_seconds) || 0;
      if (etaA !== etaB) return etaA - etaB;
      return (Number(a?.fare) || 0) - (Number(b?.fare) || 0);
    });
  }, [liveTrips]);

  const handleToggleExpand = (routeId) => {
    setExpandedRouteId((cur) =>
      String(cur) === String(routeId) ? null : routeId
    );
  };

  /* Flow:
       bike -> BikeMapPreRide (Hand Raise) -> BikeSearching -> OTP
       auto -> "Coming Soon" (PassengerTripPlanner renders it for mode !== "bike")
     `mode` MUST be passed explicitly: PassengerTripPlanner defaults a missing
     mode to "auto", which is how bike riders used to land on Coming Soon. */
  const handleContinue = (selectedTrip) => {
    if (!selectedTrip) return;
    if (isBike) {
      navigation.navigate("BikeMapPreRide", {
        trip: selectedTrip,
        pickup,
        destination,
        mode,
        route_id: null,
        target_trip_id: selectedTrip?.trip_id || selectedTrip?.id,
        fare: selectedTrip?.fare,
      });
      return;
    }
    navigation.navigate("PassengerTripPlanner", { mode: "auto" });
  };

  const routeCount = sortedTrips.length;

  /* Exactly one native map at a time: the expanded card if there is one,
     otherwise the best (first) card. */
  const expandedStillExists = sortedTrips.some(
    (trip, i) => tripKey(trip, i) === String(expandedRouteId)
  );
  const mapRouteKey = expandedStillExists
    ? String(expandedRouteId)
    : routeCount > 0
      ? tripKey(sortedTrips[0], 0)
      : null;

  return (
    <SafeAreaView style={s.safe} edges={["left", "right", "bottom"]}>
      <StatusBar backgroundColor="#009849" barStyle="light-content" />

      <ScreenHeader
        title="Available Routes"
        subtitle={isBike ? "Your route preview" : "Your route preview"}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        contentContainerStyle={s.listContent}
        data={loading ? [] : sortedTrips}
        extraData={`${expandedRouteId}|${mapRouteKey}`}
        keyExtractor={(item, index) => tripKey(item, index)}
        ListHeaderComponent={() =>
          !loading && routeCount > 0 ? (
            <Text style={s.countText}>
              {routeCount === 1 ? "1 route found for your journey" : `${routeCount} routes found for your journey`}
            </Text>
          ) : null
        }
        ListEmptyComponent={() => (
          <View style={s.stateCard}>
            <Text style={s.stateText}>
              {loading
                ? "Loading routes..."
                : searchError
                  ? searchError
                  : emptyMessage || "No public routes currently serve both locations. Try another pickup or destination."}
            </Text>
            {!loading && searchError ? (
              <TouchableOpacity
                style={s.retryButton}
                onPress={() => refreshMatchesRef.current?.()}
                activeOpacity={0.85}
              >
                <Text style={s.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        renderItem={({ item, index }) => {
          const key = tripKey(item, index);
          return (
            <RouteCard
              destination={destination}
              expanded={String(expandedRouteId) === key}
              index={index}
              isBest={routeCount > 1 && index === 0}
              onPress={handleContinue}
              onToggleExpand={handleToggleExpand}
              pickup={pickup}
              showMap={mapRouteKey === key}
              trip={item}
            />
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────
   STYLES — same values as the driver route card
   (React Native has no CSS shorthand: padding "4 8" is invalid, so every
   value below is a number or an explicit paddingVertical/paddingHorizontal.)
   ───────────────────────────────────────────── */
const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F6F4" },
  listContent: { paddingBottom: 110, paddingHorizontal: 16, paddingTop: 8 },

  countText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 4,
  },

  /* card */
  card: {
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
    ...CARD_SHADOW,
  },
  cardBest: { borderColor: "#009849", borderWidth: 1.5 },

  /* header row — badge + route code + name */
  bestRow: { alignItems: "center", flexDirection: "row", marginBottom: 12 },
  bestBadge: {
    alignSelf: "center",
    backgroundColor: "#009849",
    borderRadius: 6,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bestBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  routeCodeBadge: {
    alignSelf: "center",
    backgroundColor: "#ECFAF1",
    borderRadius: 6,
    marginRight: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  routeCodeText: { color: "#009849", fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  routeNameText: { color: "#6B7280", flex: 1, fontSize: 12, fontWeight: "600", marginLeft: 4 },

  /* route row — number + pickup/drop */
  routeRow: { alignItems: "stretch", flexDirection: "row", gap: 12, minHeight: 54 },
  routeNumCol: { alignItems: "center", justifyContent: "center", width: 32 },
  routeNumBadge: {
    alignItems: "center",
    backgroundColor: "#009849",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  routeNumText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  /* route detail — pickup / dashed connector / drop */
  routeDetail: { flex: 1, justifyContent: "space-between", minWidth: 0, paddingVertical: 4 },
  stopRowItem: { alignItems: "center", flexDirection: "row", gap: 10 },
  dotGreen: { backgroundColor: "#009849", borderRadius: 999, height: 12, width: 12 },
  dotOrange: { backgroundColor: "#f59e0b", borderRadius: 999, height: 12, width: 12 },
  stopNameText: { color: "#111827", fontSize: 14, fontWeight: "600", lineHeight: 18 },
  stopNameFlex: { flex: 1 },
  stopNameBold: { fontWeight: "800" },
  connectorDashed: {
    alignSelf: "flex-start",
    borderColor: "#d1d5db",
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    height: 14,
    marginLeft: 4.25,
  },

  /* stats bar — ETA | Ride | Fare */
  statsBar: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 12,
    paddingVertical: 10,
  },
  statItem: { alignItems: "center", flexDirection: "row", gap: 4 },
  statDivider: { backgroundColor: "#E5E7EB", height: 16, width: 1 },
  statTextCol: { alignItems: "flex-start" },
  statLabel: {
    color: "#9CA3AF",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginTop: 1,
    textTransform: "uppercase",
  },
  statValue: { color: "#374151", fontSize: 13, fontWeight: "700" },
  fareValue: { color: "#009849", fontSize: 16, fontWeight: "900" },

  /* walk microcopy */
  walkRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 8 },
  walkText: { color: "#9CA3AF", flex: 1, fontSize: 11, fontWeight: "600" },

  /* stops row — count badge + view stops toggle */
  stopsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  stopsCountBadge: {
    alignItems: "center",
    backgroundColor: "#ECFAF1",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stopsCountText: { color: "#009849", fontSize: 12, fontWeight: "700" },
  viewStopsBtn: { alignItems: "center", flexDirection: "row", gap: 4 },
  viewStopsText: { color: "#009849", fontSize: 13, fontWeight: "700" },

  /* polyline preview — the component brings its own marginBottom: 12, which the
     negative margin cancels so spacing matches a card without a map */
  mapWrap: { marginBottom: -12, marginTop: 12 },

  /* expandable stops panel */
  stopsPanel: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stopTimelineRow: { alignItems: "flex-start", flexDirection: "row", minHeight: 36 },
  stopTimelineCol: { alignItems: "center", width: 20 },
  stopTimelineDot: { borderRadius: 999, height: 10, marginTop: 4, width: 10 },
  stopTimelineLine: { backgroundColor: "#D1D5DB", flex: 1, minHeight: 16, width: 2 },
  stopTimelineContent: { flex: 1, marginLeft: 8, paddingVertical: 2 },
  stopTimelineName: { color: "#111827", fontSize: 13, fontWeight: "600" },
  stopTimelineEta: { color: "#9CA3AF", fontSize: 11, fontWeight: "500", marginTop: 1 },
  boardingBadge: {
    alignSelf: "center",
    backgroundColor: "#DCFCE7",
    borderRadius: 6,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  boardingBadgeText: { color: "#009849", fontSize: 10, fontWeight: "700" },
  alightBadge: {
    alignSelf: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  alightBadgeText: { color: "#f59e0b", fontSize: 10, fontWeight: "700" },

  /* select CTA */
  continueBtn: {
    alignItems: "center",
    backgroundColor: "#009849",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 12,
    ...Platform.select({
      ios: { shadowColor: "#009849", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  continueBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  /* empty / loading */
  stateCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 12,
    paddingVertical: 40,
  },
  stateText: { color: "#9CA3AF", fontSize: 15, fontWeight: "600", textAlign: "center" },
  retryButton: {
    backgroundColor: "#009849",
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  retryButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
