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
import ZoomControls from "../../shared/components/common/ZoomControls";

const { width } = Dimensions.get("window");

export default function BikeRideToDestinationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const buddy = route.params?.buddy;
  const mapRef = useRef(null);
  const [distance, setDistance] = useState(3.8);
  const [eta, setEta] = useState("12 min");
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const distInterval = setInterval(() => {
      setDistance((prev) => Math.max(0, +(prev - 0.015).toFixed(2)));
    }, 2000);
    const timeInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime.current) / 1000);
      setElapsed(sec);
    }, 1000);
    return () => {
      clearInterval(distInterval);
      clearInterval(timeInterval);
    };
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

  const progress = Math.max(0, Math.min(1, (3.8 - distance) / 3.8));

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleEndRide = () => {
    navigation.navigate("BikeTripComplete", { buddy });
  };

  return (
    <View style={styles.root}>
      {/* Map area */}
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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>On Ride</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

      {/* Bottom sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        <View style={styles.buddySection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buddy?.avatar || "RK"}</Text>
          </View>
          <View style={styles.buddyInfo}>
            <Text style={styles.buddyName}>{buddy?.name || "Ravi Kumar"}</Text>
            <Text style={styles.destLabel}>
              Drop: <Text style={{ fontWeight: "700", color: "#111827" }}>{buddy?.drop || "IT City"}</Text>
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
            <Text style={styles.statValue}>{distance.toFixed(1)} km</Text>
            <Text style={styles.statLabel}>remaining</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="timer" size={16} color="#F59E0B" />
            <Text style={styles.statValue}>{formatTime(elapsed)}</Text>
            <Text style={styles.statLabel}>elapsed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="speedometer" size={16} color="#3B82F6" />
            <Text style={styles.statValue}>28</Text>
            <Text style={styles.statLabel}>km/h avg</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.progressThumb, { left: `${progress * 100}%` }]}>
            <Animated.View style={[styles.progressCore, { opacity: dotAnim }]} />
          </View>
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>{buddy?.pickup || "Start"}</Text>
          <Text style={[styles.progressLabel, { color: "#EF4444" }]}>{buddy?.drop || "Drop"}</Text>
        </View>

        <TouchableOpacity style={styles.endRideBtn} onPress={handleEndRide} activeOpacity={0.85}>
          <Ionicons name="stop-circle" size={20} color="#fff" />
          <Text style={styles.endRideText}>End Ride</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },

  /* map */
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
    bottom: "52%",
    left: "40%",
    alignItems: "center",
    justifyContent: "center",
  },
  driverPulseOuter: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,152,73,0.1)",
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  destOnMap: {
    position: "absolute",
    bottom: "62%",
    left: "65%",
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  destPinStem: {
    width: 3,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#EF4444",
    marginTop: -2,
  },
  pathOnMap: {
    position: "absolute",
    bottom: "55%",
    left: "46%",
    gap: 5,
    alignItems: "center",
    flexDirection: "row",
  },
  pathDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },

  /* map header */
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

  /* bottom sheet */
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
    marginBottom: 20,
  },

  /* buddy */
  buddySection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },
  buddyInfo: {
    flex: 1,
  },
  buddyName: {
    fontSize: 17,
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
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },

  /* stats */
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginTop: 2,
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
    height: 32,
    backgroundColor: "#E5E7EB",
  },

  /* progress */
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "visible",
    marginBottom: 4,
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  progressThumb: {
    position: "absolute",
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: -8,
  },
  progressCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  /* end ride */
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
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  endRideText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },
});
