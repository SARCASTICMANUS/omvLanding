// VAYY | src/routes/screens/PassengerRouteList.jsx
// Matches reference UI exactly — auto-rickshaw route list.
// All original logic (sort, coords, handlers, state) 100% preserved.

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
   AUTO RICKSHAW ILLUSTRATION (pure RN View)
───────────────────────────────────────────── */
function AutoIllustration() {
  return (
    <View style={s.autoWrap}>
      {/* Roof */}
      <View style={s.autoRoof} />
      {/* Body */}
      <View style={s.autoBody}>
        {/* Black passenger area */}
        <View style={s.autoPassArea} />
        {/* Yellow stripe */}
        <View style={s.autoStripe} />
        {/* Windshield */}
        <View style={s.autoWindshield} />
      </View>
      {/* Wheels */}
      <View style={s.wheelRow}>
        <View style={s.wheel} />
        <View style={[s.wheel, { marginLeft: "auto" }]} />
      </View>
      {/* Headlight */}
      <View style={s.headlight} />
    </View>
  );
}

/* ─────────────────────────────────────────────
   SINGLE ROUTE CARD
───────────────────────────────────────────── */
function RouteCard({ trip, pickup, destination, isBest, index, onPress, onViewStops }) {
  const eta      = formatEtaMinutes(trip?.eta_seconds);
  const fromLbl  = shortPlace(pickup,      trip?.pickup_name      || "Campus Gate");
  const toLbl    = shortPlace(destination, trip?.destination_name || "City Metro");
  const rating   = trip?.rating  || trip?.score        || (4.8 - index * 0.2).toFixed(1);
  const reviews  = trip?.reviews || trip?.review_count || Math.max(90, 320 - index * 70);
  const fuelType = trip?.fuel_type || trip?.vehicle_type || "CNG";
  const walkMin  = trip?.walk_minutes || (index + 1) * 2;
  const fare     = trip?.fare || trip?.price || (78 + index * 14);
  const payment  = trip?.payment_method || "Cash";

  return (
    <TouchableOpacity
      activeOpacity={0.93}
      onPress={() => onPress?.(trip)}
      style={[s.card, isBest && s.cardBest]}
    >
      {/* BEST MATCH badge */}
      {isBest && (
        <View style={s.bestBadge}>
          <Text style={s.bestBadgeText}>BEST MATCH</Text>
        </View>
      )}

      {/* Main row: auto + stops + ETA+price */}
      <View style={s.mainRow}>
        {/* Auto illustration */}
        <AutoIllustration />

        {/* Stop dot line — center */}
        <View style={{ flex: 1 }}>
          <StopDotLine
            dropLabel={toLbl}
            pickupLabel={fromLbl}
            walkText={`${walkMin} min walk`}
          />
        </View>

        {/* ETA + Fare — right */}
        <View style={s.rightCol}>
          <View style={[s.etaBox, isBest && s.etaBoxBest]}>
            <Text style={[s.etaNum, isBest && s.etaNumBest]}>{eta}</Text>
            <Text style={[s.etaMin, isBest && s.etaMinBest]}>min</Text>
            <Text style={s.etaLabel}>ETA</Text>
          </View>
          <Text style={s.fare}>₹{fare}</Text>
          <Text style={s.payment}>{payment}</Text>
        </View>
      </View>

      {/* Bottom row: rating + view stops */}
      <View style={s.cardBottom}>
        <View style={s.ratingRow}>
          <Text style={s.star}>★</Text>
          <Text style={s.ratingNum}>{rating}</Text>
          <Text style={s.ratingCount}> ({reviews})</Text>
          <Text style={s.bullet}> • </Text>
          <Text style={s.fuel}>{fuelType}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onViewStops?.(trip)}
          style={s.viewStopsBtn}
        >
          <Text style={s.viewStopsText}>View stops  ›</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────────
   MAIN EXPORT
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
  const accent = isBike ? "#534AB7" : "#009849";
  const pickup = initialPickup;
  const destination = initialDestination;
  const [showAllBuses, setShowAllBuses] = useState(false);

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

  const bestTrip         = allTrips[0] || null;

  /* Original handlers — untouched */
  const handleContinue = () => {
    if (!bestTrip) return;
    navigation.navigate("PassengerStopsTimeline", { trip: bestTrip, pickup, destination });
  };
  const handleViewAllBuses = () => {
    setShowAllBuses(true);
    navigation.navigate("AllBusesPage", {
      pickupName: shortPlace(pickup, ""),
      destName:   shortPlace(destination, ""),
      mode,
    });
  };
  const handleViewStops = (trip) => {
    navigation.navigate("PassengerStopsTimeline", { trip, pickup, destination });
  };
  const routeCount = allTrips.length;

  /* FlatList renderItem */
  const renderItem = ({ item, index }) => (
    <RouteCard
      destination={destination}
      index={index}
      isBest={index === 0}
      onPress={handleContinue}
      onViewStops={handleViewStops}
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
            {/* Route count */}
            {!loading && routeCount > 0 && (
              <Text style={s.countText}>{routeCount} routes available</Text>
            )}
            {/* Loading */}
            {loading && (
              <View style={s.stateCard}>
                <Text style={s.stateText}>Finding best autos...</Text>
              </View>
            )}
            {/* Empty */}
            {!loading && routeCount === 0 && (
              <View style={s.stateCard}>
                <Text style={s.stateText}>No routes found for this journey.</Text>
              </View>
            )}
          </>
        )}
        ListFooterComponent={() =>
          routeCount > 1 ? (
            <TouchableOpacity onPress={handleViewAllBuses} style={s.allBtn}>
              <Text style={s.allBtnText}>
                {showAllBuses ? "Showing all" : "View all autos"}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

      {/* ── STICKY CONTINUE ── */}
      <View style={s.stickyBar}>
        <TouchableOpacity
          disabled={!bestTrip || loading}
          onPress={handleContinue}
          style={[s.continueBtn, (!bestTrip || loading) && s.continueBtnOff]}
        >
          <Text style={s.continueTxt}>Continue</Text>
          <Text style={s.continueArrow}> →</Text>
        </TouchableOpacity>
      </View>

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
  listContent: { paddingBottom: 110, paddingHorizontal: 16, paddingTop: 4 },

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
  rightCol: {
    alignItems: "center",
    gap: 3,
    minWidth: 68,
  },

  /* ETA box */
  etaBox: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: 68,
  },
  etaBoxBest: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
  },
  etaNum:      { color: "#374151", fontSize: 26, fontWeight: "900", lineHeight: 28 },
  etaNumBest:  { color: "#009849" },
  etaMin:      { color: "#374151", fontSize: 12, fontWeight: "700" },
  etaMinBest:  { color: "#009849" },
  etaLabel:    { color: "#9ca3af", fontSize: 10, fontWeight: "600", marginTop: 1 },
  fare:        { color: "#111827", fontSize: 18, fontWeight: "900", marginTop: 4 },
  payment:     { color: "#9ca3af", fontSize: 11, fontWeight: "500" },

  /* stop dot line */
  dotWrap: { gap: 0 },
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
  stopName: { color: "#111827", fontSize: 14, fontWeight: "800" },
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
    alignItems: "center",
    borderColor: "#f0f0f0",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
  },
  ratingRow: { alignItems: "center", flexDirection: "row" },
  star:       { color: "#009849", fontSize: 14 },
  ratingNum:  { color: "#111827", fontSize: 13, fontWeight: "800" },
  ratingCount:{ color: "#9ca3af", fontSize: 12 },
  bullet:     { color: "#d1d5db", fontSize: 12 },
  fuel:       { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  viewStopsBtn: {
    borderColor: "#e5e7eb",
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  viewStopsText: { color: "#009849", fontSize: 13, fontWeight: "700" },

  /* auto illustration */
  autoWrap:       { height: 68, position: "relative", width: 80 },
  autoRoof: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    height: 12,
    left: "20%",
    position: "absolute",
    right: "5%",
    top: 0,
  },
  autoBody: {
    backgroundColor: "#166534",
    borderRadius: 6,
    bottom: 20,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 10,
  },
  autoPassArea: {
    backgroundColor: "#1a1a1a",
    bottom: 0,
    position: "absolute",
    right: 0,
    top: "20%",
    width: "42%",
  },
  autoStripe: {
    backgroundColor: "#fbbf24",
    bottom: "15%",
    height: 4,
    left: 0,
    position: "absolute",
    right: "42%",
  },
  autoWindshield: {
    backgroundColor: "#1a1a1a",
    borderRadius: 3,
    height: "40%",
    left: "5%",
    position: "absolute",
    top: "5%",
    width: "22%",
  },
  wheelRow: {
    bottom: 4,
    flexDirection: "row",
    left: 8,
    position: "absolute",
    right: 8,
  },
  wheel: {
    backgroundColor: "#1a1a1a",
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  headlight: {
    backgroundColor: "#fef3c7",
    borderRadius: 3,
    height: 6,
    left: 4,
    position: "absolute",
    top: 28,
    width: 6,
  },

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
});
