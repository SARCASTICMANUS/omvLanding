import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import RoutePolylinePreview from "../../routes/components/RoutePolylinePreview";
import { searchDriverRoutes, getDriverRoutes } from "../services/driverService";
import { buildRouteSummary, estimateStopTimeline } from "../utils/driverFlowUtils";

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

function RouteCard({ item, index, pickup, destination, onSelect, expanded, onToggleExpand }) {
  const timeline = estimateStopTimeline(item);
  const isBest = index === 0;

  const stops = item?.stops || [];

  const startLabel =
    // pickup?.name ||
    // pickup?.display_name?.split(",")?.[0]?.trim() ||
    // firstStop?.name ||
    item.pickup_stop.name ||
    "--";
  const endLabel =
    // destination?.name ||
    // destination?.display_name?.split(",")?.[0]?.trim() ||
    // lastStop?.name ||
    item.dropoff_stop.name ||
    "--";

  const fare = item?.fare;
  const fareText = fare != null ? `₹${fare}` : "--";
  const isExpanded = expanded === item.id;

  const pickupOrder = item?.pickup_stop?.order;
  const dropoffOrder = item?.dropoff_stop?.order;
  const rideDistanceText = item?.distance_km != null ? `${item.distance_km} km` : "--";
  const firstMileKm = item?.first_mile_walk_meters != null ? (item.first_mile_walk_meters / 1000).toFixed(1) : null;
  const lastMileKm = item?.last_mile_walk_meters != null ? (item.last_mile_walk_meters / 1000).toFixed(1) : null;
  const walkMicrocopy =
    firstMileKm != null && lastMileKm != null ? `Board ${firstMileKm} km · Alight ${lastMileKm} km` : null;

  return (
    <View style={[s.card, isBest && s.cardBest]}>
      
        <View style={s.bestRow}>
          {isBest && (
          <View style={s.bestBadge}>
            <Text style={s.bestBadgeText}>BEST MATCH</Text>
          </View>)}
          {item?.route_code ? (
            <View style={s.routeCodeBadge}>
              <Text style={s.routeCodeText}>{item.route_code}</Text>
            </View>
          ) : null}
          <Text numberOfLines={1} style={s.routeNameText}>
            {item.name}
          </Text>
        </View>
      
      {/* Route visualization — start & end */}
      <TouchableOpacity activeOpacity={0.93} onPress={() => onSelect(item)}>
        <View style={s.routeRow}>
          <View style={s.routeNumCol}>
            <View style={s.routeNumBadge}>
              <Text style={s.routeNumText}>{index + 1}</Text>
            </View>
            <View style={s.routeNumLine} />
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

      {/* Stats bar — Duration | Distance | Fare */}
      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Ionicons name="time-outline" size={15} color="#6B7280" />
          <View style={s.statTextCol}>
            <Text style={s.statValue}>{item.durationText}</Text>
            <Text style={s.statLabel}>ETA</Text>
          </View>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Ionicons name="speedometer" size={14} color="#6B7280" />
          <View style={s.statTextCol}>
            <Text style={s.statValue}>{rideDistanceText}</Text>
            <Text style={s.statLabel}>Ride</Text>
          </View>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <View style={s.statTextCol}>
            <Text style={s.earningsValue}>{fareText}</Text>
            <Text style={s.statLabel}>Earnings</Text>
          </View>
        </View>
      </View>

      {/* Walk microcopy — boarding & alighting distance */}
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
          <TouchableOpacity style={s.viewStopsBtn} onPress={() => onToggleExpand(item.id)}>
            <Text style={s.viewStopsText}>{isExpanded ? "Hide Stops" : "View Stops"}</Text>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color="#009849" />
          </TouchableOpacity>
        )}
      </View>

      {/* Route polyline preview — always visible below the batch match */}
      <RoutePolylinePreview route={item} height={120} />
      {isExpanded && stops.length > 0 && (
        <View style={s.stopsPanel}>
      {timeline.map((stop, i) => {
            const isBoarding = pickupOrder != null && Number(stop.order) === Number(pickupOrder);
            const isAlighting = dropoffOrder != null && Number(stop.order) === Number(dropoffOrder);
            const dotColor = isBoarding ? "#009849" : isAlighting ? "#f59e0b" : "#D1D5DB";
            return (
              <View key={stop.id || i} style={s.stopTimelineRow}>
                <View style={s.stopTimelineCol}>
                  <View style={[s.stopTimelineDot, { backgroundColor: dotColor }]} />
                  {i < timeline.length - 1 && <View style={s.stopTimelineLine} />}
                </View>
                <View style={s.stopTimelineContent}>
                  <Text style={s.stopTimelineName} numberOfLines={1}>{stop.name}</Text>
                  <Text style={s.stopTimelineEta}>Stop {stop.order || i + 1}</Text>
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
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const mode = routeProp?.params?.mode || "bike";
  const pickup = routeProp?.params?.pickup;
  const destination = routeProp?.params?.destination;

  const fetchRoutes = async () => {
    try {
      setLoading(true);

      if (pickup?.lat && pickup?.lon && destination?.lat && destination?.lon) {
        const data = await searchDriverRoutes(pickup.lat, pickup.lon, destination.lat, destination.lon, undefined, { vehicleType: mode });
        const routes = data?.data ?? (Array.isArray(data) ? data : []);
        setRoutes(routes);
        return;
      }

      const data = await getDriverRoutes();
      const routes = data?.data ?? (Array.isArray(data) ? data : []);
      setRoutes(routes);
    } catch (error) {
      console.error("Failed to fetch routes:", error);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const normalizedRoutes = useMemo(() => {
    const summaries = routes.map(buildRouteSummary);
    const seen = new Map();
    for (const s of summaries) {
      const key = s.name || s.id;
      if (!seen.has(key)) {
        seen.set(key, s);
      } else {
        const existing = seen.get(key);
        if ((s.distanceMeters || Infinity) < (existing.distanceMeters || Infinity)) {
          seen.set(key, s);
        }
      }
    }
    return Array.from(seen.values());
  }, [routes]);

  const onSelectRoute = (selectedRoute) => {
    const routeData = {
      ...selectedRoute,
      mode,
      pickup,
      destination,
    };
    navigation.navigate(mode === "auto" ? "AutoFindPassenger" : "FindPassenger", { route: routeData });
  };

  const renderItem = ({ item, index }) => (
    <RouteCard
      destination={destination}
      expanded={expandedRouteId}
      index={index}
      item={item}
      onSelect={onSelectRoute}
      onToggleExpand={(id) => setExpandedRouteId(expandedRouteId === id ? null : id)}
      pickup={pickup}
    />
  );

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#009849" />
      <ScreenHeader
        title="Choose Route"
        subtitle="Select the route you want to drive"
        onBack={() => navigation.goBack()}
      />

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
  routeCodeBadge: {
    alignSelf: "center",
    backgroundColor: "#ECFAF1",
    borderRadius: 6,
    marginRight: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  routeCodeText: {
    color: "#009849",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
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
  stopNameFlex: {
    flex: 1,
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
  statTextCol: {
    alignItems: "flex-start",
  },
  statLabel: {
    color: "#9CA3AF",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginTop: 1,
    textTransform: "uppercase",
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

  /* walk microcopy — board / alight distance */
  walkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  walkText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
  },

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
  stopsCountText: {
    color: "#009849",
    fontSize: 12,
    fontWeight: "700",
  },
  viewStopsBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  viewStopsText: {
    color: "#009849",
    fontSize: 13,
    fontWeight: "700",
  },

  /* expandable stops panel */
  stopsPanel: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stopTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 36,
  },
  stopTimelineCol: {
    alignItems: "center",
    width: 20,
  },
  stopTimelineDot: {
    borderRadius: 999,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  stopTimelineLine: {
    backgroundColor: "#D1D5DB",
    flex: 1,
    minHeight: 16,
    width: 2,
  },
  stopTimelineContent: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 2,
  },
  stopTimelineName: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  stopTimelineEta: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  boardingBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 6,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "center",
  },
  boardingBadgeText: {
    color: "#009849",
    fontSize: 10,
    fontWeight: "700",
  },
  alightBadge: {
    alignSelf: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  alightBadgeText: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "700",
  },

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
      ios: { shadowColor: "#009849", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
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
  bestRow: { alignItems: "center", flexDirection: "row", marginBottom: 12 },
  routeNameText: { color: "#6B7280", flex: 1, fontSize: 12, fontWeight: "600", marginLeft: 4 }
});
