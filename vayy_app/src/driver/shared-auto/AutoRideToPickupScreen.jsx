import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
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

export default function AutoRideToPickupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const buddy = route.params?.buddy;
  const initialDist = buddy?.distance_km || null;
  const [distance] = useState(initialDist);
  const [eta, setEta] = useState(buddy?.eta ? `${buddy.eta} min` : "—");
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const mapRef = useRef(null);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const [showCancel, setShowCancel] = useState(false);
  const isInRange = distance <= 0.03;
  const arrivePulse = useRef(new Animated.Value(1)).current;
  const distanceAnim = useRef(new Animated.Value(1.2)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (distance == null) return;
    if (distance <= 0.03) {
      setEta("Arriving");
      return;
    }
    if (distance < 0.3) setEta("1 min");
    else if (distance < 0.6) setEta("2 min");
    else if (distance < 0.9) setEta("3 min");
  }, [distance]);

  useEffect(() => {
    Animated.timing(distanceAnim, { toValue: distance, duration: 300, useNativeDriver: false }).start();
  }, [distance, distanceAnim]);

  useEffect(() => {
    if (isInRange) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(arrivePulse, { toValue: 0.6, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(arrivePulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isInRange, arrivePulse]);

  useEffect(() => {
    const dots = [dot1, dot2, dot3];
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 300),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dot1, dot2, dot3]);

  const handleCancelRide = (reason) => {
    setShowCancel(false);
    navigation.goBack();
  };

  const handleArrived = () => setShowArrivedModal(true);

  const confirmArrival = () => {
    setShowArrivedModal(false);
    navigation.navigate("AutoRideToDestination", { buddy });
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
          <View style={styles.driverDotOuter}>
            <View style={styles.driverDotInner} />
          </View>
        </View>

        {isInRange && <View style={styles.rangeCircle} />}
        <View style={styles.buddyOnMap}>
          <View style={styles.buddyPulseRing} />
          <View style={[styles.buddyMarker, isInRange && styles.buddyMarkerActive]} />
        </View>

        <View style={styles.routeLine}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[styles.routeSeg, { opacity: 1 - i * 0.18 }]} />
          ))}
        </View>

        <View style={[styles.mapHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setShowCancel(true)}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride to Pickup</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        <View style={styles.buddyRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buddy?.avatar || "PK"}</Text>
          </View>
          <View style={styles.buddyInfo}>
            <Text style={styles.buddyName}>{buddy?.name || "Passenger"}</Text>
            <Text style={styles.buddyPickup}>{buddy?.pickup || "Pickup point"}</Text>
          </View>
          <View style={styles.etaBadge}>
            <Ionicons name="time" size={13} color={COLORS.primary} />
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        </View>

        <View style={styles.distSection}>
          <View style={styles.distHeader}>
            <Ionicons name="location" size={14} color={COLORS.primary} />
            <Text style={styles.distValue}>{distance != null ? distance.toFixed(2) : "—"} km</Text>
            <Text style={styles.distLabel}>to pickup</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(distance / 1.2 * 100)}%`,
                  backgroundColor:
                    distance <= 0.03 ? COLORS.primary :
                    distance <= 0.3 ? "#22C55E" :
                    distance <= 0.6 ? "#F59E0B" : "#EF4444",
                },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>1.2 km</Text>
            <Text style={[styles.progressLabel, { color: COLORS.primary }]}>0 km</Text>
          </View>
        </View>

        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>Heading to pickup</Text>
          <View style={styles.dotRow}>
            {[dot1, dot2, dot3].map((dot, i) => (
              <Animated.View
                key={i}
                style={[styles.loadingDot, { opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }]}
              />
            ))}
          </View>
        </View>

        {!isInRange && (
          <View style={styles.arriveHint}>
            <Ionicons name="radio" size={14} color="#9CA3AF" />
            <Text style={styles.arriveHintText}>Arrive within 30 m to activate</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.arrivedBtn, !isInRange && styles.arrivedBtnDisabled]}
          onPress={isInRange ? handleArrived : null}
          activeOpacity={isInRange ? 0.85 : 1}
          disabled={!isInRange}
        >
          <Animated.View style={[styles.arriveBtnInner, { opacity: isInRange ? arrivePulse : 0.5 }]}>
            <Ionicons name="flag" size={20} color="#fff" />
            <Text style={styles.arrivedBtnText}>I&apos;ve Arrived at Pickup</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <AutoCancelRideModal
        visible={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancelRide}
      />

      <Modal visible={showArrivedModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="checkmark-circle" size={52} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>Confirm Arrival</Text>
            <Text style={styles.modalDesc}>
              Have you reached{"\n"}
              <Text style={{ fontWeight: "700" }}>{buddy?.pickup || "the pickup point"}</Text>?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowArrivedModal(false)}>
                <Text style={styles.modalCancelText}>Not Yet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmArrival}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.modalConfirmText}>Yes, I&apos;m Here</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    left: "30%",
  },
  driverDotOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,152,73,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  driverDotInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    borderWidth: 4,
    borderColor: "#fff",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buddyOnMap: {
    position: "absolute",
    bottom: "55%",
    left: "62%",
    alignItems: "center",
    justifyContent: "center",
  },
  buddyPulseRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  buddyMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  buddyMarkerActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
  },
  rangeCircle: {
    position: "absolute",
    bottom: "55%",
    left: "62%",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "rgba(0,152,73,0.06)",
    marginLeft: -50,
    marginBottom: -50,
  },
  routeLine: {
    position: "absolute",
    bottom: "47%",
    left: "36%",
    gap: 6,
    alignItems: "center",
  },
  routeSeg: {
    width: 4,
    height: 8,
    borderRadius: 2,
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
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
  buddyRow: {
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
  buddyPickup: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 2,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFAF1",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  distSection: {
    marginBottom: 12,
  },
  distHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  distValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  distLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  dotRow: {
    flexDirection: "row",
    gap: 3,
  },
  loadingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#6B7280",
  },
  arriveHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  arriveHintText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  arrivedBtn: {
    borderRadius: 18,
    height: 56,
    overflow: "hidden",
  },
  arriveBtnInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
  },
  arrivedBtnDisabled: {
    opacity: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  arrivedBtnText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  modalIconWrap: {
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  modalDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  modalCancel: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7280",
  },
  modalConfirm: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 14,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
