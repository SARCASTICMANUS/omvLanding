import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
  Feather,
} from "@expo/vector-icons";
import { ConfirmPopup } from "../bike-ride/ConfirmPopup";

const { width } = Dimensions.get("window");
const STOP_DISTANCE = 200;
const WITHIN_RANGE = STOP_DISTANCE <= 500;

export function AutoPreRideScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showOutOfRange, setShowOutOfRange] = useState(false);
  const [withinRange] = useState(WITHIN_RANGE);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Auto pickup</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="more-vert" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.distanceCard}>
        <View style={styles.flagWrapper}>
          <Ionicons name="location" size={24} color="#009849" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Nearest stop</Text>
          <Text style={styles.cardDistance}>
            <Text style={styles.greenText}>{STOP_DISTANCE} m</Text> away
          </Text>
          <View style={styles.walkRow}>
            <Ionicons name="walk" size={14} color="#6B7280" />
            <Text style={styles.walkText}>~3 min walk</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, withinRange ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
          <View style={[styles.statusDot, withinRange ? styles.statusDotActive : styles.statusDotInactive]} />
          <Text style={[styles.statusLabel, withinRange ? styles.statusLabelActive : styles.statusLabelInactive]}>
            {withinRange ? "In range" : `${STOP_DISTANCE - 500}m away`}
          </Text>
        </View>
      </View>

      <View style={styles.mapArea}>
        <View style={styles.mapBg}>
          <View style={styles.gridLineH} />
          <View style={[styles.gridLineH, { top: "40%" }]} />
          <View style={[styles.gridLineH, { top: "70%" }]} />
          <View style={styles.gridLineV} />
          <View style={[styles.gridLineV, { left: "40%" }]} />
          <View style={[styles.gridLineV, { left: "70%" }]} />
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
            <Text style={styles.walkChipText}>{STOP_DISTANCE}m walk to stop</Text>
          </View>
        )}

        <View style={styles.floatingContainer}>
          <TouchableOpacity style={styles.floatBtn}>
            <MaterialIcons name="my-location" size={24} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn}>
            <Feather name="navigation" size={24} color="#009849" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.handle} />

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
          onPress={() => {
            if (withinRange) {
              setShowConfirm(true);
            } else {
              setShowOutOfRange(true);
            }
          }}
        >
          <Text style={[styles.raiseText, !withinRange && styles.raiseTextDisabled]}>
            ✋  {withinRange ? "Raise Hand at Stop" : `Walk ${STOP_DISTANCE}m to raise hand`}
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmPopup
        visible={showConfirm}
        title="Raise Hand at Stop?"
        message="Are you at Hazratganj Metro Gate 2? Nearby autos will be notified."
        confirmLabel="Yes, Raise Hand"
        icon="hand-left-outline"
        onConfirm={() => {
          setShowConfirm(false);
          navigation.navigate('AutoSearching');
        }}
        onCancel={() => setShowConfirm(false)}
      />

      <ConfirmPopup
        visible={showOutOfRange}
        title="Too Far From Stop"
        message={`You are ${STOP_DISTANCE}m away from Hazratganj Metro Gate 2. Walk to the stop (within 500m) to raise your hand for an auto.`}
        confirmLabel="Show Walking Route"
        icon="walk-outline"
        onConfirm={() => {
          setShowOutOfRange(false);
        }}
        onCancel={() => setShowOutOfRange(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  distanceCard: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
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
    flex: 1,
    position: "relative",
    backgroundColor: "#F9FAFB",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F9FAFB",
  },
  gridLineH: {
    position: "absolute",
    width: "100%",
    height: 1,
    backgroundColor: "#E5E7EB",
    top: "20%",
  },
  gridLineV: {
    position: "absolute",
    width: 1,
    height: "100%",
    backgroundColor: "#E5E7EB",
    left: "20%",
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
    top: 100,
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
    top: 95,
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
    top: 20,
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
    top: 60,
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
});
