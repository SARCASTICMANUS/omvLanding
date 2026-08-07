import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { searchDriverRoutes, getDriverRoutes } from "../services/driverService";
import { buildRouteSummary, estimateStopTimeline } from "../utils/driverFlowUtils";

const DUMMY_ROUTES = [
  {
    id: 101, route_id: 101, name: "Gomti Nagar → IT City", route_name: "Gomti Nagar → IT City",
    code: "VAYY-101", route_code: "VAYY-101", source_name: "Gomti Nagar, Lucknow",
    destination_name: "IT City, Lucknow", start_name: "Gomti Nagar, Lucknow",
    end_name: "IT City, Lucknow", total_distance: 4200, distance_meters: 4200,
    duration_minutes: 18, eta_minutes: 18,
    stops: [
      { name: "Gomti Nagar", order: 0, lat: 26.8513, lon: 80.9860, arrival_time: "8:00 AM" },
      { name: "Hazratganj", order: 1, lat: 26.8525, lon: 80.9489, is_boarding_point: true },
      { name: "Lalbagh", order: 2, lat: 26.8611, lon: 80.9228, is_boarding_point: true },
      { name: "IT City", order: 3, lat: 26.8857, lon: 80.8955, arrival_time: "8:20 AM" },
    ],
  },
  {
    id: 102, route_id: 102, name: "Alambagh → SGPGI", route_name: "Alambagh → SGPGI",
    code: "VAYY-102", route_code: "VAYY-102", source_name: "Alambagh, Lucknow",
    destination_name: "SGPGI, Lucknow", start_name: "Alambagh, Lucknow",
    end_name: "SGPGI, Lucknow", total_distance: 8500, distance_meters: 8500,
    duration_minutes: 25, eta_minutes: 25,
    stops: [
      { name: "Alambagh", order: 0, lat: 26.7880, lon: 80.9030, arrival_time: "7:30 AM" },
      { name: "Singar Nagar", order: 1, lat: 26.8020, lon: 80.9170, is_boarding_point: true },
      { name: "Mahanagar", order: 2, lat: 26.8300, lon: 80.9280, is_boarding_point: true },
      { name: "SGPGI", order: 3, lat: 26.8620, lon: 80.9440, arrival_time: "7:55 AM" },
    ],
  },
  {
    id: 103, route_id: 103, name: "Charbagh → Indira Nagar", route_name: "Charbagh → Indira Nagar",
    code: "VAYY-103", route_code: "VAYY-103", source_name: "Charbagh, Lucknow",
    destination_name: "Indira Nagar, Lucknow", start_name: "Charbagh, Lucknow",
    end_name: "Indira Nagar, Lucknow", total_distance: 6200, distance_meters: 6200,
    duration_minutes: 15, eta_minutes: 15,
    stops: [
      { name: "Charbagh", order: 0, lat: 26.8300, lon: 80.9200, arrival_time: "9:00 AM" },
      { name: "Aminabad", order: 1, lat: 26.8450, lon: 80.9350, is_boarding_point: true },
      { name: "Kapoorthala", order: 2, lat: 26.8700, lon: 80.9550, is_boarding_point: true },
      { name: "Indira Nagar", order: 3, lat: 26.8980, lon: 80.9760, arrival_time: "9:15 AM" },
    ],
  },
];

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

function RouteCard({ item, index, expanded, onToggleExpand, onSelect }) {
  const timeline = estimateStopTimeline(item);
  const isBest = index === 0;
  const earnings = item?.earnings || item?.estimated_earnings || (80 + index * 15);
  const demand = item?.demand || (index === 0 ? "High" : index === 1 ? "Medium" : "Low");
  const activeDrivers = item?.active_drivers || Math.max(1, 8 - index * 3);

  const stops = item?.stops || [];
  const demandColor = demand === "High" ? "#009849" : demand === "Medium" ? "#F59E0B" : "#EF4444";

  return (
    <View style={[s.card, isBest && s.cardBest]}>
      {isBest && (
        <View style={s.bestBadge}>
          <Text style={s.bestBadgeText}>BEST MATCH</Text>
        </View>
      )}

      {/* Route visualization — all stops as road-following path */}
      <TouchableOpacity activeOpacity={0.93} onPress={() => onSelect(item)}>
        <View style={s.routeRow}>
          <View style={s.routeNumCol}>
            <View style={s.routeNumBadge}>
              <Text style={s.routeNumText}>{index + 1}</Text>
            </View>
            <View style={s.routeNumLine} />
          </View>

          <View style={s.routeDetail}>
            {timeline.map((stop, si) => {
              const isFirst = si === 0;
              const isLast = si === timeline.length - 1;
              const displayName = stop.name || (isFirst ? item.startLabel : isLast ? item.endLabel : "");
              const shortName = displayName.length > 22 ? displayName.slice(0, 20) + "…" : displayName;
              return (
                <React.Fragment key={stop.id || si}>
                  <View style={s.stopRowItem}>
                    {isFirst ? <View style={s.dotGreen} />
                      : isLast ? <View style={s.dotOrange} />
                        : <View style={s.dotGray} />}
                    <Text style={[s.stopNameText, (isFirst || isLast) && s.stopNameBold]}>
                      {shortName}
                    </Text>
                  </View>
                  {!isLast && <View style={s.connectorDashed} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>

      {/* Stats bar — Driver-centric */}
      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Ionicons name="time-outline" size={15} color="#6B7280" />
          <Text style={s.statValue}>{item.durationText}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Ionicons name="speedometer" size={14} color="#6B7280" />
          <Text style={s.statValue}>{item.distanceText}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.earningsValue}>₹{earnings}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <View style={[s.demandDot, { backgroundColor: demandColor }]} />
          <Text style={s.statValue}>{demand}</Text>
        </View>
      </View>

      {/* Active drivers hint — only for best match */}
      {isBest && (
        <TouchableOpacity
          style={s.nearbyHint}
          onPress={() => onToggleExpand(item?.id || index)}
          activeOpacity={0.7}
        >
          <Ionicons name="people" size={13} color="#009849" />
          <Text style={s.nearbyHintLabel}>{activeDrivers} Marshals on route</Text>
          <Text style={s.nearbyHintText} numberOfLines={1}>
            {stops.length} stops
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {/* Expanded stops panel */}
      {expanded && timeline.length > 0 && (
        <View style={s.stopsPanel}>
          {timeline.map((stop) => (
            <View key={stop.id} style={s.stopRow}>
              <View style={s.stopSeq}>
                <Text style={s.stopSeqText}>{stop.sequence}</Text>
              </View>
              <View style={s.stopDetail}>
                <Text style={s.stopName}>{stop.name}</Text>
                <Text style={s.stopStatus}>{stop.status}</Text>
              </View>
              <Text style={s.stopArrival}>{stop.arrivalLabel}</Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={s.continueBtn}
        onPress={() => onSelect(item)}
        activeOpacity={0.85}
      >
        <Text style={s.continueBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function DriverRouteList({ navigation, route: routeProp }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDummy, setIsDummy] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const insets = useSafeAreaInsets();
  const mode = routeProp?.params?.mode || "bike";
  const pickup = routeProp?.params?.pickup;
  const destination = routeProp?.params?.destination;

  const fetchRoutes = async () => {
    try {
      setLoading(true);

      if (pickup?.lat && pickup?.lon && destination?.lat && destination?.lon) {
        const data = await searchDriverRoutes(pickup.lat, pickup.lon, destination.lat, destination.lon);
        const routes = data?.data ?? (Array.isArray(data) ? data : []);
        if (routes.length > 0) {
          setRoutes(routes);
          setIsDummy(false);
          return;
        }
      }

      const data = await getDriverRoutes();
      const routes = data?.data ?? (Array.isArray(data) ? data : []);
      if (routes.length > 0) {
        setRoutes(routes);
        setIsDummy(false);
      } else {
        setRoutes(DUMMY_ROUTES);
        setIsDummy(true);
      }
    } catch (error) {
      console.error("Failed to fetch routes, using dummy:", error);
      setRoutes(DUMMY_ROUTES);
      setIsDummy(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const normalizedRoutes = useMemo(() => routes.map(buildRouteSummary), [routes]);

  useEffect(() => {
    if (expandedRouteId && !normalizedRoutes.some((r) => String(r.id) === String(expandedRouteId))) {
      setExpandedRouteId(null);
    }
  }, [expandedRouteId, normalizedRoutes]);

  const onSelectRoute = (selectedRoute) => {
    const routeData = {
      ...selectedRoute,
      mode,
      pickup,
      destination,
    };
    navigation.navigate("DriverFindPassengers", { route: routeData });
  };

  const renderItem = ({ item, index }) => (
    <RouteCard
      expanded={String(expandedRouteId) === String(item.id)}
      index={index}
      item={item}
      onSelect={onSelectRoute}
      onToggleExpand={(id) =>
        setExpandedRouteId((cur) => (String(cur) === String(id) ? null : id))
      }
    />
  );

  return (
    <View style={s.safe}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerGradient}>
          <View style={s.gradBase} />
          <View style={s.gradRay1} />
          <View style={s.gradRay2} />
        </View>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={s.headerMid}>
            <Text style={s.headerTitle}>Choose Route</Text>
            <Text style={s.headerSub}>Select the route you want to drive</Text>
          </View>
          {isDummy && (
            <View style={s.dummyBadge}>
              <Text style={s.dummyBadgeText}>LOCAL</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        contentContainerStyle={s.listContent}
        data={normalizedRoutes}
        keyExtractor={(item, i) => String(item.id || i)}
        ListHeaderComponent={() => (
          <>
            {!loading && normalizedRoutes.length > 0 && (
              <Text style={s.countText}>
                {normalizedRoutes.length} route{normalizedRoutes.length > 1 ? "s" : ""} available
              </Text>
            )}
            {loading && (
              <View style={s.stateCard}>
                <Text style={s.stateText}>Loading routes...</Text>
              </View>
            )}
            {!loading && normalizedRoutes.length === 0 && (
              <View style={s.stateCard}>
                <Text style={s.stateText}>No routes found</Text>
              </View>
            )}
          </>
        )}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />


    </View>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: "#F4F6F4", flex: 1 },
  listContent: { paddingBottom: 110, paddingHorizontal: 16, paddingTop: 4 },

  /* header */
  header: {
    position: "relative",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  gradBase: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#009849",
  },
  gradRay1: {
    position: "absolute",
    top: -60, right: -40,
    width: "70%", height: "90%",
    backgroundColor: "#00B857",
    opacity: 0.25,
    borderRadius: 120,
    transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute",
    top: -80, right: -20,
    width: "50%", height: "70%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100,
    transform: [{ rotate: "35deg" }],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    zIndex: 2,
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
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700", marginTop: 1 },

  /* count */
  countText: {
    color: "#6B7280",
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

  /* route row — number + pickup/drop */
  routeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  routeNumCol: {
    alignItems: "center",
    gap: 6,
    width: 32,
  },
  routeNumBadge: {
    alignItems: "center",
    backgroundColor: "#009849",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  routeNumText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  routeNumLine: {
    backgroundColor: "#d1d5db",
    flex: 1,
    width: 2,
  },

  /* route detail — pickup / dashed connector / drop */
  routeDetail: {
    flex: 1,
    gap: 4,
    paddingVertical: 6,
  },
  stopRowItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  dotGreen: {
    backgroundColor: "#009849",
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  dotOrange: {
    backgroundColor: "#f59e0b",
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  dotGray: {
    backgroundColor: "#9CA3AF",
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  stopNameText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  stopNameBold: {
    fontWeight: "800",
  },
  connectorDashed: {
    borderColor: "#d1d5db",
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    height: 14,
    marginLeft: 4.25,
  },

  /* stats bar — ETA | Distance | Earnings | Demand */
  statsBar: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 12,
    paddingVertical: 10,
  },
  statItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  statDivider: {
    backgroundColor: "#E5E7EB",
    height: 16,
    width: 1,
  },
  statValue: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
  earningsValue: {
    color: "#009849",
    fontSize: 16,
    fontWeight: "900",
  },
  demandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  /* nearby hint — active drivers + stops count */
  nearbyHint: {
    alignItems: "center",
    backgroundColor: "#ECFAF1",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nearbyHintLabel: {
    color: "#009849",
    fontSize: 11,
    fontWeight: "700",
  },
  nearbyHintText: {
    color: "#374151",
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
    textAlign: "right",
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
  stopName: { color: "#111827", fontSize: 13, fontWeight: "800" },
  stopStatus: { color: "#9CA3AF", fontSize: 11 },
  stopArrival: { color: "#6B7280", fontSize: 12, fontWeight: "800" },

  /* continue CTA */
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
      ios:     { shadowColor: "#009849", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  /* dummy badge */
  dummyBadge: {
    backgroundColor: "#f59e0b",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dummyBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  /* state cards */
  stateCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 12,
    paddingVertical: 40,
  },
  stateText: { color: "#9CA3AF", fontSize: 15, fontWeight: "600" },
});
