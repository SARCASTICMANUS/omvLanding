import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DEFAULT_CENTER } from "../../constants/mapConfig";
import { useSelector } from "react-redux";
import { getAssignedVehicle } from "../services/driverService";
import useWebSocket from "../../shared/hooks/useWebSocket";
import useDriverLocationPush from "../hooks/useDriverLocationPush";
import { WS } from "../../constants";
import COLORS from "../../shared/constants/colors";
import VayyMap from "../../shared/components/VayyMap";

const { height } = Dimensions.get("window");

const CHECKS = [
  { key: "network", label: "Network", icon: "wifi" },
  { key: "gps", label: "GPS Signal", icon: "navigate" },
  { key: "location", label: "Location", icon: "location" },
  { key: "device", label: "Device Status", icon: "phone-portrait" },
];

export default function AutoFindPassengerScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state) => state.auth);
  const userId = user?.id;

  const [showVerify, setShowVerify] = useState(true);
  const [checks, setChecks] = useState(CHECKS.map((c) => ({ ...c, status: "pending" })));
  const [allPassed, setAllPassed] = useState(false);
  const [online, setOnline] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [notification, setNotification] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [eta] = useState("--");
  const [nextStop] = useState("--");
  const [progress] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const verifySlide = useRef(new Animated.Value(0)).current;
  const vehicleY = useRef(new Animated.Value(0)).current;
  const notifSlide = useRef(new Animated.Value(-100)).current;
  const scanDot = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0.3)).current;

  const handleWsMessage = useCallback((data) => {
    if (data.type === "new_dispatch_request" && data.dispatch) {
      const req = data.dispatch;
      const dispatchId = req.id || req.trip_id;
      const passengerName = req.passenger_name || req.user_name || "Passenger";
      navigation.navigate("AheadAlert", {
        dispatchId,
        passengerName,
        destination: req.drop_name || req.drop || null,
        nextStop: req.next_stop || null,
      });
    }
  }, [navigation]);

  useWebSocket(userId ? WS.notifications(userId) : null, {
    enabled: !!userId,
    onMessage: handleWsMessage,
  });

  useEffect(() => {
    if (!showVerify) return;
    Animated.spring(verifySlide, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [showVerify, verifySlide]);

  useEffect(() => {
    if (!showVerify) return;
    const run = async () => {
      const updated = [...checks];
      for (let i = 0; i < updated.length; i++) {
        updated[i] = { ...updated[i], status: "checking" };
        setChecks([...updated]);
        await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
        updated[i] = { ...updated[i], status: "passed" };
        setChecks([...updated]);
        await new Promise((r) => setTimeout(r, 200));
      }
      setAllPassed(true);
    };
    run();
  }, [showVerify]);

  useEffect(() => {
    if (!allPassed) return;
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, [allPassed, spinAnim]);

  useEffect(() => {
    if (!showVerify && online) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulse.start();
      const move = Animated.loop(
        Animated.sequence([
          Animated.timing(vehicleY, { toValue: -height * 0.4, duration: 18000, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(vehicleY, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
      move.start();
      const dot = Animated.loop(
        Animated.timing(scanDot, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      );
      dot.start();
      return () => {
        pulse.stop();
        move.stop();
        dot.stop();
      };
    }
  }, [showVerify, online, pulseAnim, vehicleY, scanDot]);

  useEffect(() => {
    if (!online || showVerify) return;
    let removed = false;
    let sub = null;
    import("../../shared/lib/locationService").then(({ default: locationService }) => {
      if (removed) return;
      locationService.startTracking((coords) => {
        if (coords.speed != null) setSpeed(Math.round(coords.speed * 3.6));
      }, { distanceInterval: 10, timeInterval: 5000 }).then((s) => { sub = s; });
    });
    return () => { removed = true; if (sub?.remove) sub.remove(); };
  }, [online, showVerify]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0.3, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dotAnim]);

  const handleStart = () => {
    Animated.timing(verifySlide, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowVerify(false);
      setOnline(true);
    });
  };

  const vehicleIdRef = useRef(null);
  const [vehicleReady, setVehicleReady] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getAssignedVehicle();
        if (!cancelled) {
          vehicleIdRef.current = res?.data?.id || res?.id;
          setVehicleReady(!!vehicleIdRef.current);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useDriverLocationPush({
    enabled: online && vehicleReady,
    vehicleId: vehicleIdRef.current,
  });

  const handleStop = () => {
    setShowMenu(false);
    setOnline(false);
    setNotification(null);
  };

  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const verifyTranslate = verifySlide.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Map area */}
      <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          initialRegion={{
            latitude: DEFAULT_CENTER.latitude,
            longitude: DEFAULT_CENTER.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        />

        {/* Moving vehicle */}
        {!showVerify && online && (
          <Animated.View style={[styles.vehicleWrap, { transform: [{ translateY: vehicleY }] }]}>
            <Animated.View style={[styles.radarRing, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.radarRing, styles.radarRing2, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.radarRing, styles.radarRing3, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.vehicleDot}>
              <Ionicons name="bicycle" size={22} color="#fff" />
            </View>
            <View style={styles.vehicleShadow} />
          </Animated.View>
        )}

        {/* Offline state */}
        {!showVerify && !online && (
          <View style={styles.offlineCenter}>
            <View style={styles.vehicleDot}>
              <Ionicons name="bicycle" size={22} color="#fff" />
            </View>
            <Text style={styles.offlineText}>Radar Offline</Text>
          </View>
        )}

        {/* Header */}
        <View style={[styles.mapHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Radar</Text>
          <View style={styles.menuWrap}>
            <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.menuBtn}>
              <Ionicons name="ellipsis-vertical" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Passenger notification banner */}
        {notification && (
          <Animated.View style={[styles.notifBanner, { transform: [{ translateY: notifSlide }] }]}>
            <View style={styles.notifDot} />
            <Text style={styles.notifText}>
              Passenger waiting <Text style={styles.notifDist}>{notification}</Text> ahead
            </Text>
          </Animated.View>
        )}

      </View>

      {/* Bottom card */}
      {!showVerify && (
        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.rideInfo}>
            <View style={styles.rideBadge}>
              <View style={[styles.rideDot, { backgroundColor: online ? "#22C55E" : "#EF4444" }]} />
              <Text style={styles.rideStatus}>{online ? "Online" : "Offline"}</Text>
            </View>
            <Text style={styles.rideRoute}>{nextStop && nextStop !== "--" ? `Towards ${nextStop}` : "On route"}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="speedometer" size={16} color="#3B82F6" />
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{speed}</Text>
                <Text style={styles.statUnit}>km/h</Text>
              </View>
              <Text style={styles.statLabel}>Speed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#F59E0B" />
              <Text style={styles.statValue}>{eta}</Text>
              <Text style={styles.statLabel}>ETA</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="location" size={16} color={COLORS.primary} />
              <Text style={styles.statValue} numberOfLines={1}>{nextStop}</Text>
              <Text style={styles.statLabel}>Next Stop</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Route progress</Text>
              <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: progress > 0.7 ? COLORS.primary : "#22C55E",
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.progressThumb,
                  {
                    left: `${progress * 100}%`,
                    backgroundColor: progress > 0.7 ? COLORS.primary : "#22C55E",
                    transform: [{ scale: dotAnim.interpolate({ inputRange: [0.3, 1], outputRange: [1, 1.4] }) }],
                  },
                ]}
              />
            </View>
            <View style={styles.progressEndpoints}>
              <Text style={styles.progressEndpoint}>Start</Text>
              <Text style={styles.progressEndpoint}>End</Text>
            </View>
          </View>
        </View>
      )}

      {/* 3-dot menu */}
      <Modal visible={showMenu} transparent animationType="none">
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuDropdown, { top: insets.top + 52, right: 16 }]}>
            {online ? (
              <TouchableOpacity style={styles.menuItem} onPress={handleStop}>
                <Ionicons name="radio-button-off" size={18} color="#EF4444" />
                <Text style={[styles.menuItemText, { color: "#EF4444" }]}>Stop Radar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={handleStart}>
                <Ionicons name="radio" size={18} color={COLORS.primary} />
                <Text style={styles.menuItemText}>Start Radar</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Verification overlay */}
      {showVerify && (
        <Animated.View style={[styles.verifyOverlay, { transform: [{ translateY: verifyTranslate }] }]}>
          <View style={[styles.verifyCard, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.verifyIconRow}>
              <View style={styles.verifyShield}>
                <Ionicons name="shield-checkmark" size={32} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.verifyTitle}>Pre-Flight Check</Text>
            <Text style={styles.verifySub}>Ensuring everything is ready before we start</Text>

            <View style={styles.checksList}>
              {checks.map((check) => (
                <View key={check.key} style={styles.checkRow}>
                  <View style={styles.checkIconWrap}>
                    {check.status === "checking" ? (
                      <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                        <Ionicons name="sync" size={18} color="#F59E0B" />
                      </Animated.View>
                    ) : check.status === "passed" ? (
                      <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                    ) : (
                      <Ionicons name="ellipse" size={10} color="rgba(255,255,255,0.45)" />
                    )}
                  </View>
                  <Text style={[styles.checkLabel, check.status === "checking" && styles.checkLabelActive]}>
                    {check.label}
                  </Text>
                  {check.status === "checking" && (
                    <View style={styles.checkProgressWrap}>
                      <View style={styles.checkProgressTrack}>
                        <View style={styles.checkProgressFill} />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {allPassed && (
              <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
                <Ionicons name="radio" size={20} color="#fff" />
                <Text style={styles.startBtnText}>Start Radar</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F0F7F3",
  },

  /* map area */
  mapArea: {
    flex: 1,
    position: "relative",
    backgroundColor: "#E8F2EC",
    overflow: "hidden",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  roadH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(0,152,73,0.12)",
    borderTopWidth: 4,
    borderTopColor: "rgba(0,152,73,0.06)",
    borderBottomWidth: 4,
    borderBottomColor: "rgba(0,152,73,0.06)",
  },
  roadV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "rgba(0,152,73,0.12)",
    borderLeftWidth: 4,
    borderLeftColor: "rgba(0,152,73,0.06)",
    borderRightWidth: 4,
    borderRightColor: "rgba(0,152,73,0.06)",
  },

  /* vehicle */
  vehicleWrap: {
    position: "absolute",
    bottom: "20%",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: 140,
    height: 140,
  },
  radarRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(0,152,73,0.15)",
  },
  radarRing2: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  radarRing3: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderColor: "rgba(0,152,73,0.2)",
  },
  vehicleDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 2,
  },
  vehicleShadow: {
    position: "absolute",
    bottom: -4,
    width: 32,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.08)",
    zIndex: 1,
  },

  /* offline */
  offlineCenter: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    alignItems: "center",
    gap: 12,
  },
  offlineText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  /* header */
  mapHeader: {
    position: "absolute",
    top: 0, left: 0, right: 0,
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
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  menuWrap: {
    width: 40,
    height: 40,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  /* notification banner */
  notifBanner: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    paddingTop: 80,
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: "center",
    zIndex: 20,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginBottom: 8,
  },
  notifText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },
  notifDist: {
    fontWeight: "800",
    color: COLORS.primary,
  },

  /* online badge */
  onlineBadge: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },

  /* menu */
  menuOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuDropdown: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 4,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },

  /* verify overlay */
  verifyOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#0F2A42",
    zIndex: 20,
  },
  verifyCard: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyIconRow: {
    marginBottom: 16,
  },
  verifyShield: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ECFAF1",
    alignItems: "center",
    justifyContent: "center",
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  verifySub: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 20,
  },

  /* checks */
  checksList: {
    width: "100%",
    gap: 4,
    marginBottom: 40,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  checkIconWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
  },
  checkLabelActive: {
    color: "#F59E0B",
    fontWeight: "700",
  },
  checkProgressWrap: {
    width: 60,
  },
  checkProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  checkProgressFill: {
    height: "100%",
    width: "60%",
    borderRadius: 2,
    backgroundColor: "#F59E0B",
  },

  /* start button */
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    height: 56,
    width: "100%",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },

  /* bottom sheet */
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  rideInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  rideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  rideDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  rideStatus: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  rideRoute: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  statUnit: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
  },
  progressSection: {
    marginBottom: 4,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  progressPct: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  progressEndpoints: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progressEndpoint: {
    fontSize: 10,
    fontWeight: "600",
    color: "#D1D5DB",
  },
});
