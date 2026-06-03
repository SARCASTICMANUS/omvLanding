import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BusIconBadge from "../../components/common/BusIconBadge";
import MetricChip from "../../components/common/MetricChip";
import RouteLine from "../../components/common/RouteLine";
import VayyButton from "../../components/common/VayyButton";
import VayyCard from "../../components/common/VayyCard";
import Header from "../../components/navigation/Header";
import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";
import { buildRouteSummary, estimateStopTimeline } from "./driverFlowUtils";

function RouteCard({ item, index, expanded, onToggleExpand, onSelect }) {
  const timeline = estimateStopTimeline(item);

  return (
    <VayyCard style={styles.routeCard}>
      <View style={styles.routeTop}>
        <BusIconBadge size={48} />
        <View style={styles.routeTitleWrap}>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          <View style={styles.routeTitleTextWrap}>
            <Text style={styles.routeTitle}>{item.title}</Text>
            <Text style={styles.routeEta}>ETA {item.durationText}</Text>
          </View>
        </View>
      </View>

      <RouteLine progress={50} />

      <View style={styles.fromToRow}>
        <Text style={styles.stopLabel}>{item.startLabel}</Text>
        <Text style={styles.arrow}>{"->"}</Text>
        <Text style={[styles.stopLabel, styles.stopLabelRight]}>{item.endLabel}</Text>
      </View>
      <Text style={styles.viaText}>via {item.viaLabel || item.via || "Sector 12"}</Text>

      <View style={styles.metrics}>
        <MetricChip value={item.distanceText} label="Distance" green />
        <MetricChip value={item.durationText} label="Duration" green />
        <MetricChip value={item.viaLabel || item.via || "--"} label="Via" green />
      </View>

      <View style={styles.routeActions}>
        <VayyButton label={expanded ? "Hide Stops" : "View Stops"} onPress={() => onToggleExpand(item.id)} variant="outline" />
        <VayyButton label="Select Route" onPress={() => onSelect(item)} />
      </View>

      {expanded ? (
        <View style={styles.stopsPanel}>
          {timeline.map((stop) => (
            <View key={stop.id} style={styles.stopRow}>
              <View style={styles.stopSeq}>
                <Text style={styles.stopSeqText}>{stop.sequence}</Text>
              </View>
              <View style={styles.stopDetail}>
                <Text style={styles.stopName}>{stop.name}</Text>
                <Text style={styles.stopStatus}>{stop.status}</Text>
              </View>
              <Text style={styles.stopArrival}>{stop.arrivalLabel}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </VayyCard>
  );
}

export default function DriverRouteList({ navigation, route }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/driver/routes/");
      setRoutes(Array.isArray(response.data) ? response.data : []);
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
    navigation.navigate("DriverTripReview", { route: selectedRoute });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header onBack={() => navigation.goBack()} subtitle="Select the route you want to drive" title="Choose Your Route" />
      <View style={styles.summaryRow}>
        <Text style={styles.availableTitle}>Available Routes</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{normalizedRoutes.length || allRoutesCount} Routes Available</Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={normalizedRoutes}
        keyExtractor={(item, index) => String(item.id || index)}
        ListEmptyComponent={
          <VayyCard>
            <Text style={styles.empty}>{loading ? "Loading routes..." : "No Routes Found"}</Text>
          </VayyCard>
        }
        renderItem={({ item, index }) => (
          <RouteCard
            expanded={String(expandedRouteId) === String(item.id)}
            index={index}
            item={item}
            onSelect={onSelectRoute}
            onToggleExpand={(id) =>
              setExpandedRouteId((cur) => (String(cur) === String(id) ? null : id))
            }
          />
        )}
      />

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>Drive safe!</Text>
        <Text style={styles.footerText}>Follow traffic rules and ensure passenger safety.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: SPACING.base,
  },
  availableTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  countPill: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  countText: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  list: { gap: SPACING.base, padding: SPACING.base, paddingBottom: 120 },
  routeCard: { gap: SPACING.md },
  routeTop: { alignItems: "center", flexDirection: "row", gap: SPACING.md },
  routeTitleWrap: { alignItems: "center", flex: 1, flexDirection: "row", gap: SPACING.sm },
  numberBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  numberText: { color: COLORS.white, fontSize: 14, fontWeight: "900" },
  routeTitleTextWrap: { flex: 1 },
  routeTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  routeEta: { color: COLORS.primary, fontSize: 12, fontWeight: "800", marginTop: 3 },
  fromToRow: { alignItems: "center", flexDirection: "row", gap: SPACING.md },
  stopLabel: { color: COLORS.text, flex: 1, fontSize: 15, fontWeight: "900" },
  stopLabelRight: { textAlign: "right" },
  arrow: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "900" },
  viaText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  routeActions: { gap: SPACING.sm },
  stopsPanel: {
    backgroundColor: "#f9fafb",
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  stopRow: { alignItems: "center", flexDirection: "row", gap: SPACING.md },
  stopSeq: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  stopSeqText: { color: COLORS.white, fontSize: 11, fontWeight: "900" },
  stopDetail: { flex: 1 },
  stopName: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  stopStatus: { color: COLORS.textMuted, fontSize: 11 },
  stopArrival: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "800" },
  empty: { color: COLORS.textMuted, fontSize: 15, fontWeight: "700", textAlign: "center" },
  footerCard: {
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    padding: SPACING.base,
    position: "absolute",
    right: 0,
  },
  footerTitle: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  footerText: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
});
