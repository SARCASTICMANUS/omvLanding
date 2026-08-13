import React, { useEffect, useMemo, useState } from "react";
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

function StopDotLine({ startLabel, endLabel, viaLabel }) {
  return (
    <View style={s.dotWrap}>
      <View style={s.dotRow}>
        <View style={s.dotGreen} />
        <View style={{ flex: 1 }}>
          <Text style={s.stopName}>{startLabel}</Text>
          <Text style={s.stopSub}>Start</Text>
        </View>
      </View>
      <View style={s.connectorWrap}>
        <View style={s.connectorLine} />
      </View>
      <View style={s.dotRow}>
        <View style={s.dotOrange} />
        <View style={{ flex: 1 }}>
          <Text style={s.stopName}>{endLabel}</Text>
          <Text style={s.stopSub}>via {viaLabel || "\u2014"}</Text>
        </View>
      </View>
    </View>
  );
}

function RouteCard({ item, index, expanded, onToggleExpand, onSelect }) {
  const timeline = estimateStopTimeline(item);

  return (
    <View style={[s.card, index === 0 && s.cardBest]}>
      {index === 0 && (
        <View style={s.bestBadge}>
          <Text style={s.bestBadgeText}>BEST MATCH</Text>
        </View>
      )}

      <View style={s.mainRow}>
        <View style={s.routeNumWrap}>
          <View style={s.routeNumBadge}>
            <Text style={s.routeNumText}>{index + 1}</Text>
          </View>
          <View style={s.routeNumLine} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.routeTitle}>{item.title}</Text>
          <StopDotLine
            startLabel={item.startLabel}
            endLabel={item.endLabel}
            viaLabel={item.viaLabel || item.via}
          />
        </View>

        <View style={s.rightCol}>
          <View style={[s.statsBox, index === 0 && s.statsBoxBest]}>
            <Ionicons name="cash" size={16} color={index === 0 ? "#009849" : "#374151"} />
            <Text style={[s.statsNum, index === 0 && s.statsNumBest]}>{item.fare ? `\u20B9${item.fare}` : "--"}</Text>
            <Text style={s.statsLabel}>est.</Text>
          </View>
        </View>
      </View>

      <View style={s.cardBottom}>
        <View style={s.metricsRow}>
          <View style={s.metric}>
            <Ionicons name="speedometer" size={13} color="#6B7280" />
            <Text style={s.metricText}>{item.distanceText}</Text>
          </View>
          <Text style={s.metricSep}>|</Text>
          <View style={s.metric}>
            <Ionicons name="time-outline" size={13} color="#6B7280" />
            <Text style={s.metricText}>{item.durationText}</Text>
          </View>
        </View>
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.viewStopsBtn}
            onPress={() => onToggleExpand(item.id)}
          >
            <Text style={s.viewStopsText}>
              {expanded ? "Hide" : "Stops"}  \u203A
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.selectBtn}
            onPress={() => onSelect(item)}
          >
            <Text style={s.selectBtnText}>Select Route</Text>
          </TouchableOpacity>
        </View>
      </View>

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
    </View>
  );
}

export function BestMatchRouteScreen({ navigation, route: routeProp }) {
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
        const data = await searchDriverRoutes(pickup.lat, pickup.lon, destination.lat, destination.lon);
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
    navigation.navigate("FindRideBuddy", { route: routeData });
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
    <SafeAreaView edges={["top"]} style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle}>Choose Route</Text>
          <Text style={s.headerSub}>Select the route you want to drive</Text>
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: "#F4F6F4", flex: 1 },
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
  headerMid: { flex: 1, marginLeft: 12 },
  headerTitle: { color: "#111827", fontSize: 24, fontWeight: "900" },
  headerSub: { color: "#6B7280", fontSize: 13, fontWeight: "500", marginTop: 1 },

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

  /* main row */
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

  /* stop dots */
  dotWrap: { gap: 0, marginTop: 6 },
  dotRow: { alignItems: "center", flexDirection: "row", gap: 10 },
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
  stopSub: { color: "#9CA3AF", fontSize: 11, fontWeight: "500", marginTop: 1 },
  connectorWrap: { alignItems: "center", height: 18, justifyContent: "center", paddingLeft: 6 },
  connectorLine: {
    borderColor: "#d1d5db",
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    height: 18,
  },

  /* right column */
  rightCol: {
    alignItems: "center",
    gap: 3,
    minWidth: 68,
  },
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
  stopName: { color: "#111827", fontSize: 13, fontWeight: "800" },
  stopStatus: { color: "#9CA3AF", fontSize: 11 },
  stopArrival: { color: "#6B7280", fontSize: 12, fontWeight: "800" },

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
