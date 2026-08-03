import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";
import VayyMap from "../../shared/components/VayyMap";
import AutoCancelRideModal from "./AutoCancelRideModal";
import ZoomControls from "../../shared/components/common/ZoomControls";

const { width } = Dimensions.get("window");

export default function AutoRideToDestinationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const buddy = route.params?.buddy;
  const initialDist = buddy?.distance_km || null;
  const [distance, setDistance] = useState(initialDist);
  const [eta, setEta] = useState(buddy?.eta ? `${buddy.eta} min` : "—");
  const [elapsed, setElapsed] = useState(0);
  const [showCancel, setShowCancel] = useState(false);
  const mapRef = useRef(null);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const startTime = useRef(Date.now());
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let removed = false;
    let sub = null;
    import("../../shared/lib/locationService").then(({ default: locationService }) => {
      if (removed) return;
      let prevPos = null;
      const destLat = buddy?.dest_lat || null;
      const destLon = buddy?.dest_lon || null;
      locationService.startTracking((coords) => {
        if (removed) return;
        if (destLat != null && destLon != null) {
          const R = 6371e3;
          const dLat = ((destLat - coords.latitude) * Math.PI) / 180;
          const dLon = ((destLon - coords.longitude) * Math.PI) / 180;
          const x = Math.sin(dLat / 2) ** 2 + Math.cos((coords.latitude * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          const distKm = R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) / 1000;
          setDistance(Math.round(distKm * 10) / 10);
          if (distKm < 0.3) setEta("Arriving");
          else if (distKm < 1) setEta("3 min");
          else setEta(`${Math.max(1, Math.round(distKm * 3))} min`);
        }
        prevPos = { latitude: coords.latitude, longitude: coords.longitude };
      }, { distanceInterval: 25, timeInterval: 5000 }).then((s) => { sub = s; });
    });
    return () => { removed = true; if (sub?.remove) sub.remove(); };
  }, [buddy?.dest_lat, buddy?.dest_lon]);
  useEffect(() => {
    const timeInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime.current) / 1000);
      setElapsed(sec);
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    if (distance < 3) setEta("10 min");
    if (distance < 2.5) setEta("7 min");
    if (distance < 1.5) setEta("4 min");
    if (distance < 0.5) setEta("1 min");
    if (distance < 0.05) setEta("Arriving");
  }, [distance]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0.3, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [dotAnim]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const totalDist = initialDist || 1;
  const progress = distance != null ? Math.max(0, Math.min(1, (totalDist - distance) / totalDist)) : 0;

  const handleEndRide = () => {
    navigation.navigate("AutoTripComplete", { buddy });
  };

  const handleCancelRide = (reason) => {
    setShowCancel(false);
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <VayyMap
          ref={mapRef}
          style={styles.mapBg}
          initialRegion={{
            latitude: 26.8467,
            longitude: 80.9462,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        />
        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

        <View style={styles.driverOnMap}>
          <View style={styles.driverPulseOuter} />
          <View style={styles.driverDot}>
            <View style={styles.driverDotCore} />
          </View>
        </View>

        <View style={styles.destOnMap}>
          <View style={styles.destPinCircle}>
            <Ionicons name="flag" size={16} color="#fff" />
          </View>
          <View style={styles.destPinStem} />
        </View>

        <View style={styles.pathOnMap}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.pathDot, { opacity: 1 - i * 0.12 }]} />
          ))}
        </View>

        <View style={[styles.mapHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setShowCancel(true)}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>On Ride</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        <View style={styles.buddySection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buddy?.avatar || "PK"}</Text>
          </View>
          <View style={styles.buddyInfo}>
            <Text style={styles.buddyName}>{buddy?.name || "Passenger"}</Text>
            <Text style={styles.destLabel}>
              Drop: <Text style={{ fontWeight: "700", color: "#111827" }}>{buddy?.drop || "Destination"}</Text>
            </Text>
          </View>
          <View style={styles.etaBadge}>
            <Ionicons name="time" size={13} color="#fff" />
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={16} color={COLORS.primary} />
            <Text style={styles.statValue}>{distance != null ? distance.toFixed(1) : "—"} km</Text>
            <Text style={styles.statLabel}>remaining</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color="#F59E0B" />
            <Text style={styles.statValue}>{formatTime(elapsed)}</Text>
            <Text style={styles.statLabel}>elapsed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="speedometer" size={16} color="#3B82F6" />
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>28</Text>
              <Text style={styles.statUnit}>km/h</Text>
            </View>
            <Text style={styles.statLabel}>avg speed</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Trip progress</Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: progress > 0.8 ? COLORS.primary : "#22C55E",
                },
              ]}
            />
            <Animated.View
              style={[
                styles.progressThumb,
                {
                  left: `${progress * 100}%`,
                  backgroundColor: progress > 0.8 ? COLORS.primary : "#22C55E",
                  transform: [{ scale: dotAnim.interpolate({ inputRange: [0.3, 1], outputRange: [1, 1.3] }) }],
                },
              ]}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.endRideBtn} onPress={handleEndRide} activeOpacity={0.85}>
          <Ionicons name="stop-circle" size={22} color="#fff" />
          <Text style={styles.endRideText}>End Ride</Text>
        </TouchableOpacity>
      </View>

      <AutoCancelRideModal
        visible={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancelRide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  mapArea: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  driverOnMap: {
    position: "absolute",
    bottom: "42%",
    left: "28%",
    alignItems: "center",
    justifyContent: "center",
  },
  driverPulseOuter: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,152,73,0.08)",
  },
  driverDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  driverDotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  destOnMap: {
    position: "absolute",
    bottom: "55%",
    left: "68%",
    alignItems: "center",
  },
  destPinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  destPinStem: {
    width: 3,
    height: 10,
    backgroundColor: "#EF4444",
    borderRadius: 2,
  },
  pathOnMap: {
    position: "absolute",
    bottom: "48%",
    left: "33%",
    flexDirection: "row",
    gap: 10,
  },
  pathDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  mapHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 15,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  buddySection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  buddyInfo: {
    flex: 1,
  },
  buddyName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  destLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 2,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EF4444",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
  },
  statUnit: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E5E7EB",
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  progressPct: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F3F4F6",
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  endRideBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    borderRadius: 18,
    height: 56,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  endRideText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },
});
