import React, { useEffect } from "react";
import { StyleSheet, Text, View, FlatList, ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import RADIUS from "../../shared/constants/radius";
import VayyCard from "../../shared/components/common/VayyCard";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import { fetchRideHistory } from "../../store/slices/rideSlice";

export default function JourneyHistoryScreen({ navigation }) {
  const dispatch = useDispatch();
  const { history, historyLoading, historyCount } = useSelector((state) => state.ride);

  useEffect(() => {
    dispatch(fetchRideHistory({ page: 1 }));
  }, [dispatch]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const renderItem = ({ item }) => (
    <VayyCard style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.tripRoute}>
          <Ionicons name="location" size={16} color={COLORS.primary} />
          <Text style={styles.routeName}>{item.route_name || item.route || "Unknown Route"}</Text>
        </View>
        <View style={[styles.statusBadge, item.status === "completed" ? styles.completedBadge : styles.pendingBadge]}>
          <Text style={[styles.statusText, item.status === "completed" ? styles.completedText : styles.pendingText]}>
            {item.status || "completed"}
          </Text>
        </View>
      </View>
      <View style={styles.tripDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{formatDate(item.started_at || item.ended_at)}</Text>
        </View>
        {item.vehicle_number && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Vehicle</Text>
            <Text style={styles.detailValue}>{item.vehicle_number}</Text>
          </View>
        )}
        {item.rating && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Rating</Text>
            <Text style={styles.detailValue}>★ {typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating?.score ? Number(item.rating.score).toFixed(1) : "--"}</Text>
          </View>
        )}
      </View>
    </VayyCard>
  );

  return (
    <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#009849" />
      <ScreenHeader
        title="Journey History"
        subtitle={historyCount > 0 ? `${historyCount} trip${historyCount !== 1 ? "s" : ""}` : "Your completed trips"}
        onBack={() => navigation.goBack()}
      />
      {historyLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="time-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No journeys yet</Text>
          <Text style={styles.emptySubtext}>Your trip history will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: "500",
  },
  list: {
    padding: SPACING.base,
    gap: SPACING.md,
  },
  tripCard: {
    padding: SPACING.md,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  tripRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  completedBadge: {
    backgroundColor: COLORS.success,
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  completedText: {
    color: COLORS.primary,
  },
  pendingText: {
    color: "#92400E",
  },
  tripDetails: {
    gap: SPACING.sm,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
});
