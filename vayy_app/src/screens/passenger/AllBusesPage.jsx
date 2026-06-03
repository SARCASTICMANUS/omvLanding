import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import VayyButton from "../../components/common/VayyButton";
import BusCard from "../../components/passenger/BusCard";
import api from "../../lib/api";
import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

export default function AllBusesPage({ navigation, route }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const pickupName = route?.params?.pickupName || "Current Location";
  const destName = route?.params?.destName || "Destination";

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/passenger/dashboard/");
      const data = response.data;
      let allTrips = [];

      if (Array.isArray(data.active_trips)) allTrips = data.active_trips;
      else if (Array.isArray(data.results)) allTrips = data.results;
      else if (Array.isArray(data)) allTrips = data;

      setTrips(allTrips);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchTrips());
  }, []);

  const handleBusClick = (trip) => {
    const tripId = trip.id || trip.trip_id;
    navigation.navigate("PassengerLiveTracking", { tripId });
  };

  const filteredBuses = useMemo(
    () =>
      trips.filter(
        (bus) =>
          (bus.bus_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (bus.route_name || "").toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, trips],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{"<"}</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Buses running on your route</Text>
          <Text style={styles.subtitle}>Real-time updates • Accurate ETA • Live tracking</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>?</Text>
          <TextInput
            onChangeText={setSearchTerm}
            placeholder="Search by bus number or route..."
            placeholderTextColor={COLORS.textLight}
            style={styles.searchInput}
            value={searchTerm}
          />
        </View>

        <View style={styles.filterRow}>
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>{loading ? "..." : filteredBuses.length} Active Buses</Text>
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>Sort</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routeChip}>
          <Text numberOfLines={1} style={styles.routeChipText}>{pickupName}</Text>
          <Text style={styles.routeArrow}>{"->"}</Text>
          <Text numberOfLines={1} style={styles.routeChipText}>{destName}</Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={filteredBuses}
        keyExtractor={(item, index) => String(item.id || item.trip_id || index)}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {searchTerm ? "No buses match your search" : "No buses available"}
              </Text>
              <Text style={styles.emptyText}>
                {searchTerm
                  ? `No buses found for "${searchTerm}".`
                  : "No active buses on this route right now."}
              </Text>
              <VayyButton label="Refresh" onPress={fetchTrips} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={loading} tintColor={COLORS.primary} onRefresh={fetchTrips} />
        }
        renderItem={({ item }) => <BusCard onPress={handleBusClick} trip={item} />}
      />

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          All timings are estimated and may vary based on traffic conditions.
        </Text>
        <TouchableOpacity onPress={fetchTrips}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.base,
  },
  backButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  backText: {
    color: COLORS.text,
    fontSize: 34,
    lineHeight: 36,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  controls: {
    backgroundColor: COLORS.white,
    gap: SPACING.md,
    padding: SPACING.base,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
  },
  searchIcon: {
    color: COLORS.textLight,
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  searchInput: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    height: 46,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  activePill: {
    alignItems: "center",
    backgroundColor: COLORS.success,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    height: 8,
    width: 8,
  },
  activeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  filterButton: {
    borderColor: COLORS.borderMedium,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  routeChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    maxWidth: "100%",
    padding: SPACING.md,
  },
  routeChipText: {
    color: COLORS.textSecondary,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  routeArrow: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "900",
  },
  listContent: {
    gap: SPACING.base,
    padding: SPACING.base,
    paddingBottom: 92,
  },
  emptyState: {
    alignItems: "center",
    gap: SPACING.md,
    paddingTop: SPACING.xxxl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  disclaimer: {
    alignItems: "center",
    backgroundColor: COLORS.success,
    borderTopColor: COLORS.successBorder,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    left: 0,
    padding: SPACING.base,
    position: "absolute",
    right: 0,
  },
  disclaimerText: {
    color: COLORS.textSecondary,
    flex: 1,
    fontSize: 12,
  },
  refreshText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },
});
