import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";

const { width, height } = Dimensions.get("window");

const CHECKS = [
  { key: "network", label: "Network Connection", icon: "wifi" },
  { key: "gps", label: "GPS Signal", icon: "navigate" },
  { key: "location", label: "Location Permission", icon: "location" },
  { key: "ready", label: "Device Readiness", icon: "checkmark-circle" },
];

const BUDDIES = [
  { id: "b1", name: "Ravi Kumar", rating: 4.8, trips: 23, pickup: "Hazratganj", drop: "IT City", distance: "400 m", fare: "₹35", eta: "4 min", avatar: "RK" },
  { id: "b2", name: "Priya Singh", rating: 4.9, trips: 17, pickup: "Lalbagh", drop: "SGPGI", distance: "280 m", fare: "₹25", eta: "3 min", avatar: "PS" },
  { id: "b3", name: "Amit Verma", rating: 4.7, trips: 31, pickup: "Gomti Nagar", drop: "Indira Nagar", distance: "550 m", fare: "₹40", eta: "5 min", avatar: "AV" },
];

export default function BikeFindPassengerScreen({ navigation, route: navRoute }) {
  const insets = useSafeAreaInsets();
  const [showVerify, setShowVerify] = useState(true);
  const [checks, setChecks] = useState(CHECKS.map((c) => ({ ...c, status: "pending" })));
  const [allPassed, setAllPassed] = useState(false);
  const [phase, setPhase] = useState("scanning");
  const [currentBuddy, setCurrentBuddy] = useState(null);
  const [buddyIndex, setBuddyIndex] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const scanDot = useRef(new Animated.Value(0)).current;
  const verifySlide = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

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
    if (!showVerify) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulse.start();
      const spin = Animated.loop(
        Animated.timing(scanDot, { toValue: 1, duration: 2500, easing: Easing.linear, useNativeDriver: true }),
      );
      spin.start();
      const timer = setTimeout(() => {
        setCurrentBuddy(BUDDIES[buddyIndex]);
        setPhase("found");
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 55, useNativeDriver: true }).start();
      }, 5000);
      return () => {
        pulse.stop();
        spin.stop();
        clearTimeout(timer);
      };
    }
  }, [showVerify, buddyIndex, slideAnim, pulseAnim, scanDot]);

  useEffect(() => {
    if (!allPassed) return;
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, [allPassed, spinAnim]);

  const handleStartScanning = () => {
    Animated.timing(verifySlide, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowVerify(false);
    });
  };

  const handleAccept = () => {
    navigation.navigate("BikeRideToPickup", { buddy: currentBuddy });
  };

  const handleIgnore = () => {
    Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => {
      const next = (buddyIndex + 1) % BUDDIES.length;
      setBuddyIndex(next);
      setCurrentBuddy(null);
      setPhase("scanning");
      setTimeout(() => {
        setCurrentBuddy(BUDDIES[next]);
        setPhase("found");
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 55, useNativeDriver: true }).start();
      }, 3000);
    });
  };

  const scanRotate = scanDot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const statusIcon = (status) => {
    if (status === "checking") return null;
    if (status === "passed") return <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />;
    return <Ionicons name="ellipse" size={10} color="#D1D5DB" />;
  };

  const verifyTranslate = verifySlide.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.radarArea}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.pulseRing, styles.pulseRing2, { transform: [{ scale: pulseAnim }] }]} />

        {!showVerify && (
          <Animated.View style={[styles.scanArc, { transform: [{ rotate: scanRotate }] }]}>
            <View style={styles.scanCone} />
          </Animated.View>
        )}

        <View style={styles.radarCenter}>
          <Ionicons name="bicycle" size={28} color="#fff" />
        </View>

        <View style={[styles.blip, { top: "32%", left: "58%" }]} />
        <View style={[styles.blip, { top: "52%", left: "28%", opacity: 0.5 }]} />
        <View style={[styles.blip, { top: "62%", left: "68%", opacity: 0.35 }]} />
        <View style={[styles.blip, { top: "42%", left: "48%", opacity: 0.6 }]} />

        <View style={[styles.mapHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Buddy</Text>
          <View style={{ width: 40 }} />
        </View>

        {!showVerify && (
          <Text style={styles.scanningText}>
            {phase === "scanning" ? "Scanning for nearby buddies..." : "Buddy found!"}
          </Text>
        )}
      </View>

      {/* Buddy card bottom sheet */}
      <Animated.View
        style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}
        pointerEvents={phase === "found" ? "auto" : "none"}
      >
        <View style={styles.handle} />
        {currentBuddy && (
          <>
            <View style={styles.buddyCard}>
              <View style={styles.buddyCardHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{currentBuddy.avatar}</Text>
                </View>
                <View style={styles.buddyMeta}>
                  <Text style={styles.buddyName}>{currentBuddy.name}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={13} color="#FFB800" />
                    <Text style={styles.ratingValue}>{currentBuddy.rating}</Text>
                    <Text style={styles.ratingTrips}>({currentBuddy.trips} trips)</Text>
                  </View>
                </View>
                <View style={styles.fareBadge}>
                  <Text style={styles.fareValue}>{currentBuddy.fare}</Text>
                  <Text style={styles.fareLabel}>est.</Text>
                </View>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routeIconCol}>
                  <View style={styles.routeDotGreen} />
                  <View style={styles.routeLine} />
                  <View style={styles.routeDotRed} />
                </View>
                <View style={styles.routeDetails}>
                  <View style={styles.routePoint}>
                    <Text style={styles.routeLabel}>Pickup</Text>
                    <Text style={styles.routeName}>{currentBuddy.pickup}</Text>
                  </View>
                  <View style={styles.routePoint}>
                    <Text style={styles.routeLabel}>Drop</Text>
                    <Text style={styles.routeName}>{currentBuddy.drop}</Text>
                  </View>
                </View>
                <View style={styles.routeRight}>
                  <View style={styles.distanceChip}>
                    <Ionicons name="walk" size={12} color={COLORS.primary} />
                    <Text style={styles.distanceText}>{currentBuddy.distance}</Text>
                  </View>
                  <Text style={styles.etaLabel}>{currentBuddy.eta}</Text>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.ignoreBtn} onPress={handleIgnore} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#EF4444" />
                <Text style={styles.ignoreText}>Ignore</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>

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
                    ) : (
                      statusIcon(check.status)
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
              <TouchableOpacity style={styles.startBtn} onPress={handleStartScanning} activeOpacity={0.85}>
                <Ionicons name="radio" size={20} color="#fff" />
                <Text style={styles.startBtnText}>Start Finding Buddy</Text>
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
    backgroundColor: "#0F2A42",
  },

  /* radar area */
  radarArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: "rgba(0, 152, 73, 0.2)",
  },
  pulseRing2: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  scanArc: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  scanCone: {
    width: 90,
    height: 90,
    backgroundColor: "rgba(0, 152, 73, 0.05)",
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
  },
  radarCenter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
  blip: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00E676",
    shadowColor: "#00E676",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  scanningText: {
    position: "absolute",
    bottom: 40,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.3,
  },

  /* bottom sheet */
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
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

  /* buddy card */
  buddyCard: {
    backgroundColor: "#fff",
    marginBottom: 4,
  },
  buddyCardHead: {
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
  buddyMeta: {
    flex: 1,
  },
  buddyName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  ratingTrips: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  fareBadge: {
    backgroundColor: "#ECFAF1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  fareValue: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.primary,
  },
  fareLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: -1,
  },

  /* route */
  routeRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
  },
  routeIconCol: {
    alignItems: "center",
    width: 12,
    paddingTop: 4,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#D1D5DB",
    marginVertical: 3,
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  routeDetails: {
    flex: 1,
    justifyContent: "space-between",
    gap: 10,
  },
  routePoint: {},
  routeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  routeName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 1,
  },
  routeRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
  },
  distanceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFAF1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  etaLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  /* actions */
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  ignoreBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  ignoreText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },
  acceptBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  acceptText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },

  /* verify overlay */
  verifyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
});
