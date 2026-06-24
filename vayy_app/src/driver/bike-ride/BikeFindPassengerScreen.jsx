import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import COLORS from "../../shared/constants/colors";

const { width, height } = Dimensions.get("window");

const INITIAL_REGION = {
  latitude: 26.8467,
  longitude: 80.9462,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const PASSENGERS = [
  { id: "p1", name: "Ravi Kumar", rating: 4.8, trips: 23, pickup: "Hazratganj", drop: "IT City", distance: "400 m", fare: "₹35", eta: "4 min", lat: 26.8525, lng: 80.9489 },
  { id: "p2", name: "Priya Singh", rating: 4.9, trips: 17, pickup: "Lalbagh", drop: "SGPGI", distance: "280 m", fare: "₹25", eta: "3 min", lat: 26.8611, lng: 80.9228 },
  { id: "p3", name: "Amit Verma", rating: 4.7, trips: 31, pickup: "Gomti Nagar", drop: "Indira Nagar", distance: "550 m", fare: "₹40", eta: "5 min", lat: 26.8513, lng: 80.9860 },
];

export default function BikeFindPassengerScreen({ navigation, route: navRoute }) {
  const insets = useSafeAreaInsets();
  const [showVerify, setShowVerify] = useState(true);
  const [online, setOnline] = useState(false);
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [passengerIndex, setPassengerIndex] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [bikePos] = useState({ latitude: 26.8467, longitude: 80.9462 });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const verifySlide = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showVerify) return;
    Animated.spring(verifySlide, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [showVerify, verifySlide]);

  const handleStart = () => {
    Animated.timing(verifySlide, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowVerify(false);
      setOnline(true);
      setPhase("scanning");
    });
  };

  useEffect(() => {
    if (!online) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    const sweep = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }),
    );
    sweep.start();
    const timer = setTimeout(() => {
      setSelectedPassenger(PASSENGERS[passengerIndex]);
      setPhase("found");
      Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 50, useNativeDriver: true }).start();
    }, 4000);
    return () => {
      pulse.stop();
      sweep.stop();
      clearTimeout(timer);
    };
  }, [online, passengerIndex, pulseAnim, sweepAnim]);

  const handleAccept = () => {
    navigation.navigate("BikeRideToPickup", { buddy: selectedPassenger });
  };

  const handleIgnore = () => {
    Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => {
      const next = (passengerIndex + 1) % PASSENGERS.length;
      setPassengerIndex(next);
      setSelectedPassenger(null);
      setPhase("scanning");
      setTimeout(() => {
        setSelectedPassenger(PASSENGERS[next]);
        setPhase("found");
        Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 50, useNativeDriver: true }).start();
      }, 3000);
    });
  };

  const sweepRotate = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const verifyTranslate = verifySlide.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Real map background */}
      <MapView
        initialRegion={INITIAL_REGION}
        style={styles.map}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* Passenger markers */}
        {online && PASSENGERS.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.passengerMarker}>
              <View style={styles.passengerDot} />
            </View>
          </Marker>
        ))}
        {/* Bike marker */}
        <Marker coordinate={bikePos} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.bikeMarker}>
            <Ionicons name="bicycle" size={22} color="#fff" />
          </View>
        </Marker>
      </MapView>

      {/* Overlay tint */}
      <View style={styles.overlayTint} />

      {/* Radar center */}
      <View style={styles.radarCenter} pointerEvents="none">
        {online && (
          <>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.pulseRing, styles.pulseRing2, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.pulseRing, styles.pulseRing3, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.sweepArc, { transform: [{ rotate: sweepRotate }] }]}>
              <View style={styles.sweepCone} />
            </Animated.View>
          </>
        )}
      </View>

      {/* Status badge */}
      {online && phase === "scanning" && (
        <View style={styles.statusBadge}>
          <View style={styles.statusDotLive} />
          <Text style={styles.statusText}>Scanning nearby area...</Text>
        </View>
      )}

      {online && phase === "found" && (
        <View style={[styles.statusBadge, styles.statusBadgeFound]}>
          <Ionicons name="person" size={14} color={COLORS.primary} />
          <Text style={styles.statusText}>Buddy found!</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buddy Radar</Text>
        <TouchableOpacity
          style={[styles.headerBtn, online && styles.headerBtnActive]}
          onPress={() => setOnline(!online)}
        >
          <Ionicons
            name={online ? "radio" : "radio-button-off"}
            size={20}
            color={online ? "#fff" : "#111827"}
          />
        </TouchableOpacity>
      </View>

      {/* Offline state */}
      {!showVerify && !online && (
        <View style={styles.offlineWrap}>
          <View style={styles.offlineIconWrap}>
            <Ionicons name="radio-button-off" size={36} color="rgba(0,0,0,0.15)" />
          </View>
          <Text style={styles.offlineTitle}>Radar Offline</Text>
          <Text style={styles.offlineSub}>Tap the radio icon to start</Text>
        </View>
      )}

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}
        pointerEvents={phase === "found" ? "auto" : "none"}
      >
        <View style={styles.handle} />
        {selectedPassenger && phase === "found" && (
          <>
            <View style={styles.sheetHead}>
              <View style={styles.sheetAvatar}>
                <Ionicons name="person-circle" size={44} color={COLORS.primary} />
              </View>
              <View style={styles.sheetMeta}>
                <Text style={styles.sheetName}>{selectedPassenger.name}</Text>
                <View style={styles.sheetRow}>
                  <Ionicons name="star" size={12} color="#FFB800" />
                  <Text style={styles.sheetRating}>{selectedPassenger.rating}</Text>
                  <Text style={styles.sheetDivider}>|</Text>
                  <Text style={styles.sheetTrips}>{selectedPassenger.trips} trips</Text>
                </View>
              </View>
              <View style={styles.sheetFare}>
                <Text style={styles.sheetFareValue}>{selectedPassenger.fare}</Text>
                <Text style={styles.sheetFareLabel}>est.</Text>
              </View>
            </View>

            <View style={styles.routeCard}>
              <View style={styles.routeDots}>
                <View style={styles.routeDotGreen} />
                <View style={styles.routeLine} />
                <View style={styles.routeDotRed} />
              </View>
              <View style={styles.routeInfo}>
                <View>
                  <Text style={styles.routeLabel}>FROM</Text>
                  <Text style={styles.routeName}>{selectedPassenger.pickup}</Text>
                </View>
                <View>
                  <Text style={styles.routeLabel}>TO</Text>
                  <Text style={styles.routeName}>{selectedPassenger.drop}</Text>
                </View>
              </View>
              <View style={styles.routeMeta}>
                <View style={styles.distBadge}>
                  <Ionicons name="walk" size={12} color={COLORS.primary} />
                  <Text style={styles.distText}>{selectedPassenger.distance}</Text>
                </View>
                <Text style={styles.etaText}>{selectedPassenger.eta}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleIgnore} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#EF4444" />
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={handleAccept} activeOpacity={0.85}>
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.pickText}>Pick Up</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>

      {/* Verification overlay */}
      {showVerify && (
        <Animated.View style={[styles.verifyOverlay, { transform: [{ translateY: verifyTranslate }] }]}>
          <View style={[styles.verifyCard, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.verifyIcon}>
              <Ionicons name="bicycle" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.verifyTitle}>Ready to Ride</Text>
            <Text style={styles.verifySub}>Enable your radar to find nearby buddies</Text>

            <View style={styles.verifyChecks}>
              {[
                { key: "network", label: "Network", icon: "wifi" },
                { key: "gps", label: "GPS Signal", icon: "navigate" },
                { key: "location", label: "Location", icon: "location" },
              ].map((check) => (
                <View key={check.key} style={styles.verifyRow}>
                  <Ionicons name={check.icon} size={16} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.verifyLabel}>{check.label}</Text>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
              <Ionicons name="radio" size={20} color="#fff" />
              <Text style={styles.startBtnText}>Start Radar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  /* map */
  map: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },

  /* markers */
  passengerMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  passengerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#00E676",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#00E676",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  bikeMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },

  /* overlay tint */
  overlayTint: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(15,42,66,0.4)",
  },

  /* radar center */
  radarCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -110,
    marginTop: -110,
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: "rgba(0,230,118,0.15)",
  },
  pulseRing2: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  pulseRing3: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderColor: "rgba(0,230,118,0.25)",
  },
  sweepArc: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  sweepCone: {
    width: 90,
    height: 90,
    backgroundColor: "rgba(0,230,118,0.04)",
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    borderTopWidth: 2,
    borderTopColor: "rgba(0,230,118,0.3)",
    borderLeftWidth: 2,
    borderLeftColor: "rgba(0,230,118,0.3)",
    borderRightWidth: 2,
    borderRightColor: "rgba(0,230,118,0.3)",
  },

  /* status badge */
  statusBadge: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 5,
  },
  statusBadgeFound: {
    backgroundColor: "#ECFAF1",
  },
  statusDotLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  /* header */
  header: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
  },
  headerBtn: {
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
  headerBtnActive: {
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },

  /* offline */
  offlineWrap: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,42,66,0.95)",
    zIndex: 10,
  },
  offlineIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  offlineSub: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },

  /* bottom sheet */
  bottomSheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 20,
    zIndex: 30,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetMeta: {
    flex: 1,
  },
  sheetName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  sheetRating: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  sheetDivider: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  sheetTrips: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  sheetFare: {
    backgroundColor: "#ECFAF1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  sheetFareValue: {
    fontSize: 19,
    fontWeight: "900",
    color: COLORS.primary,
  },
  sheetFareLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: -1,
  },

  /* route card */
  routeCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
  },
  routeDots: {
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
  routeInfo: {
    flex: 1,
    justifyContent: "space-between",
    gap: 10,
  },
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
  routeMeta: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
  },
  distBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFAF1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  etaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  /* actions */
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 4,
  },
  skipBtn: {
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
  skipText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },
  pickBtn: {
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
  pickText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },

  /* verify overlay */
  verifyOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#0F2A42",
    zIndex: 40,
  },
  verifyCard: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  verifyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  verifySub: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginBottom: 36,
    lineHeight: 20,
  },
  verifyChecks: {
    width: "100%",
    gap: 8,
    marginBottom: 36,
  },
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  verifyLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
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
