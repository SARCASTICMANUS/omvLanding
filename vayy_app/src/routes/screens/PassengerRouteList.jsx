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
   ORIGINAL HELPERS — UNTOUCHED
───────────────────────────────────────────── */
export function formatEtaMinutes(etaSeconds) {
  return Math.max(1, Math.ceil(Number(etaSeconds || 300) / 60));
}
export function formatDistanceText(trip) {
  if (trip?.distance_text) return trip.distance_text;
  if (trip?.distance_km) return `${trip.distance_km} km`;
  return "45 km";
}
export function formatDurationText(trip) {
  if (trip?.duration_text) return trip.duration_text;
  if (trip?.eta_seconds) return `${formatEtaMinutes(trip.eta_seconds)} min`;
  return "45 min";
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
   STOP DOT LINE  (green circle → dashed → orange circle)
───────────────────────────────────────────── */
function StopDotLine({ pickupLabel, dropLabel, walkText }) {
  return (
    <View style={s.dotWrap}>
      {/* Pickup row */}
      <View style={s.dotRow}>
        <View style={s.dotGreen} />
        <View style={{ flex: 1 }}>
          <Text style={s.stopName}>{pickupLabel}</Text>
          <Text style={s.stopSub}>Pickup{walkText ? `  •  ${walkText}` : ""}</Text>
        </View>
      </View>
      {/* Dashed line connector */}
      <View style={s.connectorWrap}>
        <View style={s.connectorLine} />
      </View>
      {/* Drop row */}
      <View style={s.dotRow}>
        <View style={s.dotOrange} />
        <View style={{ flex: 1 }}>
          <Text style={s.stopName}>{dropLabel}</Text>
          <Text style={s.stopSub}>Drop-off</Text>
        </View>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   SINGLE ROUTE CARD  (driver-style)
───────────────────────────────────────────── */
function RouteCard({ trip, pickup, destination, isBest, index, onPress, onToggleExpand, expanded }) {
  // const eta      = formatEtaMinutes(trip?.eta_seconds);
  const fromLbl  = shortPlace(pickup,      trip?.pickup_name      || "Campus Gate");
  const toLbl    = shortPlace(destination, trip?.destination_name || "City Metro");
  const rating   = trip?.rating  || trip?.score        || (4.8 - index * 0.2).toFixed(1);
  const reviews  = trip?.reviews || trip?.review_count || Math.max(90, 320 - index * 70);
  // const fuelType = trip?.fuel_type || trip?.vehicle_type || "CNG";
  const walkMin  = trip?.walk_minutes || (index + 1) * 2;
  const fare     = trip?.fare || trip?.price || (78 + index * 14);
  const payment  = trip?.payment_method || "Cash";
  const dist     = formatDistanceText(trip);
  const dur      = formatDurationText(trip);
  const stops    = trip?.stops || [];

  return (
    <View style={[s.card, isBest && s.cardBest]}>
      {isBest && (
        <View style={s.bestBadge}>
          <Text style={s.bestBadgeText}>BEST MATCH</Text>
        </View>
      )}

      <TouchableOpacity activeOpacity={0.93} onPress={() => onPress?.(trip)}>
        <View style={s.mainRow}>
          <View style={s.routeNumWrap}>
            <View style={s.routeNumBadge}>
              <Text style={s.routeNumText}>{index + 1}</Text>
            </View>
            <View style={s.routeNumLine} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.routeTitle}>{fromLbl} → {toLbl}</Text>
            <StopDotLine
              dropLabel={toLbl}
              pickupLabel={fromLbl}
              walkText={`${walkMin} min walk`}
            />
          </View>

          <View style={s.rightCol}>
            <View style={[s.statsBox, isBest && s.statsBoxBest]}>
              <Ionicons name="cash" size={16} color={isBest ? "#009849" : "#374151"} />
              <Text style={[s.statsNum, isBest && s.statsNumBest]}>₹{fare}</Text>
              <Text style={s.statsLabel}>{payment}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={s.cardBottom}>
        <View style={s.metricsRow}>
          <View style={s.metric}>
            <Ionicons name="star" size={13} color="#6B7280" />
            <Text style={s.metricText}>{rating} ({reviews})</Text>
          </View>
          <Text style={s.metricSep}>|</Text>
          <View style={s.metric}>
            <Ionicons name="speedometer" size={13} color="#6B7280" />
            <Text style={s.metricText}>{dist}</Text>
          </View>
          <Text style={s.metricSep}>|</Text>
          <View style={s.metric}>
            <Ionicons name="time-outline" size={13} color="#4a5261" />
            <Text style={s.metricText}>{dur}</Text>
          </View>
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.viewStopsBtn}
            onPress={() => onToggleExpand(trip?.id || trip?.trip_id || index)}
          >
            <Text style={s.viewStopsText}>
              {expanded ?  " Hide " : "Stops ›"}  
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.selectBtn}
            onPress={() => onPress?.(trip)}
          >
            <Text style={s.selectBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>

      {expanded && stops.length > 0 && (
        <View style={s.stopsPanel}>
          {stops.map((stop, si) => (
            <View key={si} style={s.stopRow}>
              <View style={s.stopSeq}>
                <Text style={s.stopSeqText}>{si + 1}</Text>
              </View>
              <View style={s.stopDetail}>
                <Text style={s.stopName}>{stop.name}</Text>
                <Text style={s.stopStatus}>{stop.status || "Upcoming"}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* MAIN EXPORT */
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

  /* Original sort — untouched */
  const allTrips = useMemo(() => {
    if (!Array.isArray(trips)) return [];
    return [...trips].sort((a, b) => {
      const aRO = a.is_route_only || a.trip_available === false;
      const bRO = b.is_route_only || b.trip_available === false;
      if (aRO !== bRO) return aRO ? 1 : -1;
      if (!aRO) return (a.eta_seconds || 0) - (b.eta_seconds || 0);
      return 0;
    });
  }, [trips]);

  const bestTrip = allTrips[0] || null;

  /* Handlers */
  const handleContinue = (tripOverride = null) => {
    const trip = tripOverride || bestTrip;
    console.log("trip :",trip)
    if (!trip) return;
    if (mode === "auto") {
      navigation.navigate("AutoPreRide", { trip, pickup, destination, mode });
    } else if (mode === "bike") {
      navigation.navigate("BikeMapPreRide", { trip, pickup, destination, mode });
    }
  };
  const routeCount = allTrips.length;

  /* FlatList renderItem */
  const renderItem = ({ item, index }) => (
    <RouteCard
      destination={destination}
      expanded={String(expandedRouteId) === String(item?.id || item?.trip_id || index)}
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

      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={s.headerMid}>
          <Text style={s.headerTitle}>Best Match</Text>
          <Text style={[s.headerSub, { color: accent }]}>{isBike ? "Bike" : "Auto"} routes</Text>
        </View>

        <TouchableOpacity style={s.iconBtn}>
          <Text style={s.gearIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* ── ROUTE LIST ── */}
      <FlatList
        contentContainerStyle={s.listContent}
        data={loading ? [] : allTrips}
        keyExtractor={(item, i) => String(item?.id || item?.trip_id || i)}
        ListHeaderComponent={() => (
          <>
            {!loading && routeCount > 0 && (
              <Text style={s.countText}>{routeCount} routes available</Text>
            )}
            {loading && (
              <View style={s.stateCard}>
                <Text style={s.stateText}>{isBike ? "Finding best bikes..." : "Finding best autos..."}</Text>
              </View>
            )}
            {!loading && routeCount === 0 && (
              <View style={s.stateCard}>
                <Text style={s.stateText}>No routes found for this journey.</Text>
              </View>
            )}
          </>
        )}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

      {/* ── MATCHING BANNER ── */}
      {bestTrip && !loading && routeCount > 0 && (
        <View style={s.matchingBanner}>
          <View style={s.matchingBannerContent}>
            <Text style={s.matchingIcon}>🔍</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.matchingTitle}>{isBike ? "Bike found" : "Auto found"} on your route</Text>
              <Text style={s.matchingSub}>Select a route or wait for best match</Text>
            </View>
            <View style={s.matchingBarSmall}>
              <View style={s.matchingBarFill} />
            </View>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────
   STYLES — object-based StyleSheet
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

  /* layout */
  safe:        { backgroundColor: "#F4F6F4", flex: 1 },
  listContent: { paddingBottom: 140, paddingHorizontal: 16, paddingTop: 4 },

  /* header */
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
  backArrow:  { color: "#111827", fontSize: 20, fontWeight: "700" },
  gearIcon:   { color: "#009849", fontSize: 18 },
  headerMid:  { flex: 1, marginLeft: 12 },
  headerTitle:{ color: "#111827", fontSize: 24, fontWeight: "900" },
  headerSub:  { color: "#009849", fontSize: 14, fontWeight: "700", marginTop: 1 },

  /* count */
  countText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
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
  cardBest: {
    borderColor: "#009849",
    borderWidth: 1.5,
  },

  /* best badge */
  bestBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#009849",
    borderRadius: 6,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bestBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  /* main row inside card */
  mainRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  routeNumWrap: {
    alignItems: "center",
    gap: 4,
    width: 32,
  },
  routeNumBadge: {
    alignItems: "center",
    backgroundColor: "#009849",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  routeNumText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  routeNumLine: {
    backgroundColor: "#d1d5db",
    flex: 1,
    width: 2,
  },
  routeTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  rightCol: {
    alignItems: "center",
    gap: 3,
    minWidth: 68,
  },

  /* stats box (replaces ETA box) */
  statsBox: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 68,
  },
  statsBoxBest: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
  },
  statsNum: { color: "#374151", fontSize: 18, fontWeight: "900", lineHeight: 20 },
  statsNumBest: { color: "#009849" },
  statsLabel: { color: "#9CA3AF", fontSize: 10, fontWeight: "600" },

  /* stop dot line */
  dotWrap: { gap: 0, marginTop: 2 },
  dotRow:  { alignItems: "center", flexDirection: "row", gap: 10 },
  dotGreen: {
    borderColor: "#009849",
    borderRadius: 999,
    borderWidth: 2.5,
    height: 14,
    width: 14,
  },
  dotOrange: {
    borderColor: "#f59e0b",
    borderRadius: 999,
    borderWidth: 2.5,
    height: 14,
    width: 14,
  },
  stopName: { color: "#111827", fontSize: 13, fontWeight: "800" },
  stopSub:  { color: "#9ca3af", fontSize: 11, fontWeight: "500", marginTop: 1 },
  connectorWrap: { alignItems: "center", height: 18, justifyContent: "center", paddingLeft: 6 },
  connectorLine: {
    borderColor: "#d1d5db",
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    height: 18,
  },

  /* card bottom */
  cardBottom: {
    borderColor: "#f0f0f0",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  metricSep: {
    color: "#d1d5db",
    fontSize: 14,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewStopsBtn: {
    borderColor: "#e5e7eb",
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewStopsText: { color: "#009849", fontSize: 13, fontWeight: "700" },
  selectBtn: {
    flex: 1,
    backgroundColor: "#009849",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  selectBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  /* stops panel */
  stopsPanel: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  stopRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  stopSeq: {
    alignItems: "center",
    backgroundColor: "#009849",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  stopSeqText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  stopDetail: { flex: 1 },
  stopStatus: { color: "#9CA3AF", fontSize: 11 },

  /* footer / all button */
  allBtn: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: "#009849",
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  allBtnText: { color: "#009849", fontSize: 14, fontWeight: "700" },

  /* state cards */
  stateCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 12,
    paddingVertical: 40,
  },
  stateText: { color: "#9ca3af", fontSize: 15, fontWeight: "600" },

  /* sticky CTA */
  stickyBar: {
    backgroundColor: "#fff",
    borderColor: "#f0f0f0",
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    position: "absolute",
    right: 0,
  },
  continueBtn: {
    alignItems: "center",
    backgroundColor: "#009849",
    borderRadius: 18,
    flexDirection: "row",
    height: 56,
    justifyContent: "center",
    ...Platform.select({
      ios:     { shadowColor: "#009849", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  continueBtnOff: {
    backgroundColor: "#d1d5db",
    ...Platform.select({
      ios:     { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  continueTxt:   { color: "#fff", fontSize: 17, fontWeight: "900" },
  continueArrow: { color: "#fff", fontSize: 20, fontWeight: "900" },

  /* matching banner */
  matchingBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 100,
  },
  matchingBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  matchingIcon: { fontSize: 24 },
  matchingTitle: { fontSize: 14, fontWeight: "800", color: "#111827" },
  matchingSub: { fontSize: 12, color: "#6B7280", fontWeight: "500", marginTop: 1 },
  matchingBarSmall: {
    width: 4,
    height: 32,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
    alignSelf: "center",
  },
  matchingBarFill: {
    width: "100%",
    height: "60%",
    backgroundColor: "#009849",
    borderRadius: 2,
  },

});
