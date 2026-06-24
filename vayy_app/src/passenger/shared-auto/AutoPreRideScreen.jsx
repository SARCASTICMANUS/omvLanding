import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import MapView from "react-native-maps";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
  Feather,
} from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const STOP_DISTANCE = 200;
const THRESHOLD = 500;

export function AutoPreRideScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showOutOfRange, setShowOutOfRange] = useState(false);
  const [distanceToStop] = useState(STOP_DISTANCE);
  const withinRange = distanceToStop <= THRESHOLD;
  const mapRef = useRef(null);

  useEffect(() => {
    if (withinRange) {
      // Auto-enable when within range
    }
  }, [withinRange]);

  const zoomIn = () => {
    mapRef.current?.animateCamera({ zoom: 16 });
  };

  const zoomOut = () => {
    mapRef.current?.animateCamera({ zoom: 12 });
  };

  const handleRaiseHand = () => {
    if (distanceToStop <= THRESHOLD) {
      setShowConfirm(true);
    } else {
      setShowOutOfRange(true);
    }
  };

  const handleConfirmRaise = () => {
    setShowConfirm(false);
    navigation.replace('AutoDiscovery');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapArea}>
        <MapView
          style={styles.mapBg}
          ref={mapRef}
          initialRegion={{
            latitude: 26.8467,
            longitude: 80.9462,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
          zoomControlEnabled={true}
        />

        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.headerLeft}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Hand Raise</Text>
          </View>
        </View>

        <View style={styles.distanceCard}>
          <View style={styles.flagWrapper}>
            <Ionicons name="location" size={24} color="#009849" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Nearest stop</Text>
            <Text style={styles.cardDistance}>
              <Text style={styles.greenText}>{distanceToStop} m</Text> away
            </Text>
            <View style={styles.walkRow}>
              <Ionicons name="walk" size={14} color="#6B7280" />
              <Text style={styles.walkText}>~3 min walk</Text>
            </View>
          </View>
          <View style={[styles.proximityRing, withinRange && styles.proximityRingActive]}>
            <Text style={[styles.proximityText, withinRange && styles.proximityTextActive]}>
              {withinRange ? "✓" : `${distanceToStop - THRESHOLD}m`}
            </Text>
          </View>
        </View>

        <View style={styles.poiLabel}>
          <Ionicons name="train-outline" size={14} color="#60A5FA" />
          <Text style={styles.poiText}>Charbagh</Text>
        </View>

        <View style={styles.autoLabel}>
          <Text style={styles.autoLabelText}>Hazratganj{'\n'}Metro Gate 2</Text>
          <View style={styles.labelArrow} />
        </View>

        <View style={styles.autoMarkerOuter}>
          <View style={styles.autoMarker}>
            <Text style={{ fontSize: 20 }}>🛺</Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routeSegment1} />
          <View style={styles.routeSegment2} />
          <View style={styles.routeSegment3} />
          <View style={styles.routeMidDot} />
        </View>

        <View style={styles.liveAutosChip}>
          <View style={styles.liveDot} />
          <Ionicons name="car" size={16} color="#009849" />
          <Text style={styles.liveAutosText}>3 autos on route</Text>
        </View>

        {!withinRange && (
          <View style={styles.walkChip}>
            <Ionicons name="walk" size={16} color="#111827" />
            <Text style={styles.walkChipText}>{distanceToStop}m walk to stop</Text>
          </View>
        )}

        <View style={styles.floatingContainer}>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomOut}>
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn}>
            <MaterialIcons name="my-location" size={24} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn}>
            <Feather name="navigation" size={24} color="#009849" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>Before you raise your hand</Text>
          <View style={styles.instructionStep}>
            <View style={styles.stepDot}><Text style={styles.stepNum}>1</Text></View>
            <Text style={styles.stepText}>Walk to <Text style={styles.stepBold}>Hazratganj Metro Gate 2</Text></Text>
          </View>
          <View style={styles.instructionStep}>
            <View style={styles.stepDot}><Text style={styles.stepNum}>2</Text></View>
            <Text style={styles.stepText}>Raise your hand to signal approaching autos</Text>
          </View>
        </View>

        <View style={styles.availabilityRow}>
          <View style={styles.availItem}>
            <Ionicons name="car" size={16} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>3</Text> autos</Text>
          </View>
          <View style={styles.availDot} />
          <View style={styles.availItem}>
            <Ionicons name="time-outline" size={16} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>~4 min</Text></Text>
          </View>
          <View style={styles.availDot} />
          <View style={styles.availItem}>
            <Ionicons name="cash-outline" size={16} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>₹15</Text> fare</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.raiseBtn, !withinRange && styles.raiseBtnDisabled]}
          onPress={handleRaiseHand}
        >
          <Text style={[styles.raiseText, !withinRange && styles.raiseTextDisabled]}>
            ✋  {withinRange ? "Raise Hand" : `${distanceToStop}m from stop`}
          </Text>
        </TouchableOpacity>

        {!withinRange && (
          <Text style={styles.proximityHint}>
            You must be within 500m of the stop to notify nearby autos
          </Text>
        )}
      </View>

      {/* Raise Hand Confirmation Modal */}
      {showConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="hand-left-outline" size={40} color="#009849" />
            </View>
            <Text style={styles.modalTitle}>Raise Hand?</Text>
            <Text style={styles.modalMessage}>
              Nearby auto drivers will be notified that you are waiting at the stop.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={handleConfirmRaise}
              >
                <Text style={styles.modalBtnPrimaryText}>Raise Hand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Out of Range Modal */}
      {showOutOfRange && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconWrap, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="walk-outline" size={40} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Move Closer To Stop</Text>
            <Text style={styles.modalMessage}>
              You are currently {distanceToStop}m away.{'\n'}
              You must move {distanceToStop - THRESHOLD}m closer before notifying nearby autos.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: "#009849" }]}
                onPress={() => setShowOutOfRange(false)}
              >
                <Text style={styles.modalBtnPrimaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F8FAF9",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: "rgba(0,152,73,0.6)",
    overflow: "hidden",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  distanceCard: {
    position: "absolute",
    top: 140,
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 4,
  },
  flagWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardLabel: {
    fontSize: 14,
    color: "#888888",
    fontWeight: "500",
    marginBottom: 2,
  },
  cardDistance: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  greenText: {
    color: "#009849",
  },
  walkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  walkText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeActive: {
    backgroundColor: "#ECFAF1",
  },
  statusBadgeInactive: {
    backgroundColor: "#FEF2F2",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: "#00E676",
  },
  statusDotInactive: {
    backgroundColor: "#EF4444",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusLabelActive: {
    color: "#009849",
  },
  statusLabelInactive: {
    color: "#EF4444",
  },
  mapArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F9FAFB",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  poiLabel: {
    position: "absolute",
    top: "35%",
    left: "15%",
    alignItems: "center",
    gap: 4,
  },
  poiText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  autoLabel: {
    position: "absolute",
    top: 135,
    right: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  autoLabelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    lineHeight: 18,
  },
  labelArrow: {
    position: "absolute",
    bottom: -6,
    right: 12,
    width: 12,
    height: 12,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
  autoMarkerOuter: {
    position: "absolute",
    top: 130,
    right: 45,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,152,73,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  autoMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  routeContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  routeSegment1: {
    position: "absolute",
    top: 160,
    right: 70,
    width: 4,
    height: 120,
    backgroundColor: "#009849",
    borderRadius: 2,
  },
  routeSegment2: {
    position: "absolute",
    top: 275,
    right: 70,
    width: 110,
    height: 4,
    backgroundColor: "#009849",
    transform: [{ rotate: "45deg" }, { translateX: -35 }],
    borderRadius: 2,
  },
  routeSegment3: {
    position: "absolute",
    top: 380,
    left: "48%",
    width: 4,
    height: 100,
    backgroundColor: "#009849",
    borderRadius: 2,
  },
  routeMidDot: {
    position: "absolute",
    top: 360,
    left: "47.5%",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#009849",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  liveAutosChip: {
    position: "absolute",
    top: 240,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00E676",
  },
  liveAutosText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  floatingContainer: {
    position: "absolute",
    right: 20,
    bottom: 200,
    gap: 12,
  },
  floatBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
  },
  zoomText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },
  availabilityRow: {
    flexDirection: "row",
    backgroundColor: "#ECFAF1",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  availItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  availText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  availBold: {
    fontWeight: "800",
    color: "#009849",
  },
  walkChip: {
    position: "absolute",
    top: 300,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  walkChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  raiseBtn: {
    height: 60,
    borderRadius: 20,
    backgroundColor: "#009849",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#009849",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  raiseBtnDisabled: {
    backgroundColor: "rgba(0,152,73,0.35)",
    shadowOpacity: 0,
    elevation: 0,
  },
  raiseText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  raiseTextDisabled: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
  },
  proximityRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FCA5A5",
  },
  proximityRingActive: {
    backgroundColor: "#ECFAF1",
    borderColor: "#009849",
  },
  proximityText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#EF4444",
  },
  proximityTextActive: {
    color: "#009849",
  },
  instructionCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNum: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stepText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    flex: 1,
  },
  stepBold: {
    fontWeight: "800",
    color: "#111827",
  },
  proximityHint: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  modalOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalBtnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },
  modalBtnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
