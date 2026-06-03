import React, {useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";

import BusIconBadge from "../../components/common/BusIconBadge";
import EtaBadge from "../../components/common/EtaBadge";
import MetricChip from "../../components/common/MetricChip";
import RouteLine from "../../components/common/RouteLine";
import VayyButton from "../../components/common/VayyButton";
import VayyCard from "../../components/common/VayyCard";
import Header from "../../components/navigation/Header";
import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

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

export function hasValidCoords(point) {
  return (
    point &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon)
  );
}

function toLatLng(point) {
  if (!hasValidCoords(point)) {
    return null;
  }

  return { latitude: point.lat, longitude: point.lon };
}

function getRouteCoordinates(trip, pickup, destination) {
  const rawPath =
    trip?.route_geometry ||
    trip?.path_coords ||
    trip?.route_path ||
    trip?.path ||
    trip?.route?.path_coords ||
    trip?.route?.route_geometry;

  if (Array.isArray(rawPath) && rawPath.length > 1) {
    return rawPath
      .map((coord) => {
        if (!Array.isArray(coord) || coord.length < 2) return null;
        const first = Number(coord[0]);
        const second = Number(coord[1]);
        if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
        return Math.abs(first) <= 90
          ? { latitude: first, longitude: second }
          : { latitude: second, longitude: first };
      })
      .filter(Boolean);
  }

  const start = toLatLng(pickup);
  const end = toLatLng(destination);
  return start && end ? [start, end] : [];
}

function BestMatchCard({ trip, pickup, destination }) {
  const isRouteOnly = trip?.is_route_only || trip?.trip_available === false;
  const busNo =
    trip?.bus_number ||
    trip?.vehicle_number ||
    trip?.vehicle_no ||
    (isRouteOnly ? "Route match" : "UP 32 DC 0003");
  const eta = formatEtaMinutes(trip?.eta_seconds);
  const fromLabel = shortPlace(pickup, trip?.pickup_name || "Noida");
  const toLabel = shortPlace(destination, trip?.destination_name || "Delhi");
  const distance = formatDistanceText(trip);
  const duration = formatDurationText(trip);
  const stopsCount = Array.isArray(trip?.stops)
    ? trip.stops.length
    : trip?.stops_count || trip?.stop_count || 8;

  return (
    <VayyCard style={styles.bestCard}>
      <View style={styles.cardTop}>
        <Text style={styles.tag}>{isRouteOnly ? "ROUTE FOUND" : "NEXT ARRIVING BUS"}</Text>
        <EtaBadge minutes={eta} size="sm" />
      </View>

      <View style={styles.busRow}>
        <BusIconBadge size={46} />
        <View style={styles.busInfo}>
          <Text style={styles.busNo}>{busNo}</Text>
          <Text style={styles.busType}>{trip?.seat_type || trip?.vehicle_type || "AC Seater"}</Text>
        </View>
        <Text style={styles.rating}>Rating {trip?.rating || trip?.score || "4.6"}</Text>
      </View>

      <RouteLine progress={55} />

      <View style={styles.placeRow}>
        <View style={styles.placeCol}>
          <Text style={styles.place}>{fromLabel}</Text>
          <Text style={styles.time}>{trip?.start_time || trip?.departure_time || "7:00 AM"}</Text>
        </View>
        <View style={[styles.placeCol, styles.placeColRight]}>
          <Text style={styles.place}>{toLabel}</Text>
          <Text style={styles.time}>{trip?.end_time || trip?.arrival_time || "8:00 AM"}</Text>
        </View>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {isRouteOnly ? "Route found but no active bus" : "Passing your stop"}
        </Text>
        <TouchableOpacity>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricRow}>
        <MetricChip value={distance} label="Distance" />
        <MetricChip value={duration} label="Duration" />
        <MetricChip value={stopsCount} label="Stops" />
      </View>
    </VayyCard>
  );
}

export default function PassengerRouteList({ navigation, route }) {
  const {
    pickup: initialPickup,
    destination: initialDestination,
  } = route?.params || {};
  const [pickup, setPickup] = useState(initialPickup);
  const [destination, setDestination] = useState(initialDestination);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllBuses, setShowAllBuses] = useState(false);

  const fetchFilteredTrips = async (p, d) => {
    if (!p?.lat || !p?.lon || !d?.lat || !d?.lon) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/api/passenger/filtered-trips/", {
        pickup: { lat: p.lat, lon: p.lon, name: p.name || "" },
        destination: { lat: d.lat, lon: d.lon, name: d.name || "" },
      });
      setTrips(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch filtered trips:", error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilteredTrips(pickup, destination);
  }, []);

  const allTrips = useMemo(() => {
    if (!Array.isArray(trips)) return [];

    return [...trips].sort((a, b) => {
      const aRouteOnly = a.is_route_only || a.trip_available === false;
      const bRouteOnly = b.is_route_only || b.trip_available === false;

      if (aRouteOnly !== bRouteOnly) {
        return aRouteOnly ? 1 : -1;
      }

      if (!aRouteOnly) {
        return (a.eta_seconds || 0) - (b.eta_seconds || 0);
      }

      return 0;
    });
  }, [trips]);
  const bestTrip = allTrips[0] || null;
  const routeCoordinates = getRouteCoordinates(bestTrip, pickup, destination);
  const pickupCoord = toLatLng(pickup);
  const destinationCoord = toLatLng(destination);
  const mapInitial = pickupCoord || destinationCoord || { latitude: 28.6139, longitude: 77.209 };

  const handleContinue = () => {
    if (!bestTrip) return;
    navigation.navigate("PassengerStopsTimeline", { trip: bestTrip, pickup, destination });
  };

  const handleViewAllBuses = () => {
    setShowAllBuses(true);
    navigation.navigate("AllBusesPage", {
      pickupName: shortPlace(pickup, ""),
      destName: shortPlace(destination, ""),
    });
  };

  const onUpdatePickup = (event) => {
    const coordinate = event.nativeEvent.coordinate;
    setPickup({ ...pickup, lat: coordinate.latitude, lon: coordinate.longitude });
  };

  const onUpdateDestination = (event) => {
    const coordinate = event.nativeEvent.coordinate;
    setDestination({ ...destination, lat: coordinate.latitude, lon: coordinate.longitude });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header onBack={() => navigation.goBack()} subtitle="Match" title="Best Match" />
      <View style={styles.content}>
        <View style={styles.heroArt}>
          <BusIconBadge size={58} />
          <View style={styles.heroLine} />
          <Text style={styles.heroEta}>ETA {bestTrip ? formatEtaMinutes(bestTrip.eta_seconds) : "--"} min</Text>
        </View>

        <MapView
          initialRegion={{
            ...mapInitial,
            latitudeDelta: 0.18,
            longitudeDelta: 0.18,
          }}
          style={styles.map}
        >
          {routeCoordinates.length > 1 ? (
            <Polyline coordinates={routeCoordinates} strokeColor={COLORS.primary} strokeWidth={4} />
          ) : null}
          {pickupCoord ? (
            <Marker
              coordinate={pickupCoord}
              draggable
              onDragEnd={onUpdatePickup}
              pinColor={COLORS.primary}
            />
          ) : null}
          {destinationCoord ? (
            <Marker
              coordinate={destinationCoord}
              draggable
              onDragEnd={onUpdateDestination}
              pinColor={COLORS.error}
            />
          ) : null}
        </MapView>

        {loading ? (
          <VayyCard>
            <Text style={styles.emptyText}>Loading routes...</Text>
          </VayyCard>
        ) : bestTrip ? (
          <BestMatchCard destination={destination} pickup={pickup} trip={bestTrip} />
        ) : (
          <VayyCard>
            <Text style={styles.emptyText}>No route found</Text>
          </VayyCard>
        )}

        <View style={styles.actions}>
          <VayyButton
            disabled={!bestTrip || loading}
            fullWidth
            label="Continue ->"
            onPress={handleContinue}
            size="lg"
          />
          <VayyButton
            fullWidth
            label={showAllBuses ? "Showing all buses" : "View all buses"}
            onPress={handleViewAllBuses}
            variant="outline"
          />
          <VayyButton
            disabled={!pickup || !destination || loading}
            fullWidth
            label="Refresh Routes"
            onPress={() => fetchFilteredTrips(pickup, destination)}
            variant="ghost"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    gap: SPACING.base,
    padding: SPACING.base,
  },
  heroArt: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.base,
  },
  heroLine: {
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    borderTopWidth: 2,
    flex: 1,
  },
  heroEta: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  map: {
    borderRadius: RADIUS.lg,
    height: 300,
    overflow: "hidden",
    width: "100%",
  },
  bestCard: {
    gap: SPACING.md,
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tag: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  busRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  busInfo: {
    flex: 1,
  },
  busNo: {
    color: COLORS.black,
    fontSize: 22,
    fontWeight: "900",
  },
  busType: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  rating: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: "900",
  },
  placeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  placeCol: {
    flex: 1,
  },
  placeColRight: {
    alignItems: "flex-end",
  },
  place: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  time: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  banner: {
    alignItems: "center",
    backgroundColor: COLORS.success,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: SPACING.md,
  },
  bannerText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  changeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  actions: {
    gap: SPACING.md,
  },
});
