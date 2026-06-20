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
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";
import { ConfirmPopup } from "../../passenger/bike-ride/ConfirmPopup";

const { width } = Dimensions.get("window");
const STOP_DISTANCE = 200;
const WITHIN_RANGE = STOP_DISTANCE <= 500;

export function FindPassengerScreen({ navigation, route: navRoute }) {
  const insets = useSafeAreaInsets();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showOutOfRange, setShowOutOfRange] = useState(false);
  const [withinRange] = useState(WITHIN_RANGE);
  const [radarActive, setRadarActive] = useState(false);

  const selectedRoute = navRoute?.params?.route;

  const handleOpenRadar = () => {
    if (!withinRange) {
      setShowOutOfRange(true);
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmRadar = () => {
    setShowConfirm(false);
    setRadarActive(true);
    navigation.navigate("AheadAlert", { route: selectedRoute });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          {Platform.OS === "ios" && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Find Passengers</Text>
        </View>
      </View>

      <View style={styles.distanceCard}>
        <View style={styles.flagWrapper}>
          <Ionicons name="location" size={24} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Nearest passenger</Text>
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
          <Text style={styles.poiLabelText}>Bus Stop</Text>
        </View>

        <View style={styles.radarCenter}>
          <View style={styles.radarOuter}>
            <View style={styles.radarInner}>
              <Ionicons name="navigate" size={28} color={COLORS.primary} />
            </View>
          </View>
        </View>

        <View style={[styles.passengerDot, { top: "48%", left: "58%" }]}>
          <Ionicons name="person" size={14} color="#fff" />
        </View>
        <View style={[styles.passengerDot, { top: "35%", left: "38%" }]}>
          <Ionicons name="person" size={14} color="#fff" />
        </View>
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.routeInfo}>
          <Ionicons name="git-branch-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.routeInfoText} numberOfLines={1}>
            {selectedRoute?.name || selectedRoute?.route_name || "Route selected"}
          </Text>
        </View>

        <Text style={styles.rangeNote}>
          {withinRange
            ? "Passengers are within your range. Open radar to find them."
            : `You are ${STOP_DISTANCE - 500}m away from the nearest passenger. Move closer.`}
        </Text>

        <TouchableOpacity
          style={[
            styles.radarBtn,
            !withinRange && styles.radarBtnDisabled,
            radarActive && styles.radarBtnActive,
          ]}
          onPress={handleOpenRadar}
          activeOpacity={0.8}
        >
          <Ionicons
            name={radarActive ? "radio" : "locate"}
            size={20}
            color={COLORS.white}
          />
          <Text style={styles.radarBtnText}>
            {radarActive ? "Radar Active" : withinRange ? "Open Radar" : "Out of Range"}
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmPopup
        visible={showConfirm}
        confirmColor={COLORS.primary}
        confirmLabel="Yes, Scan"
        message="Start scanning for nearby passengers on your route?"
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmRadar}
        title="Open Radar"
      />

      {showOutOfRange && (
        <View style={styles.outOfRangeOverlay}>
          <View style={styles.outOfRangeCard}>
            <Ionicons name="warning-outline" size={40} color={COLORS.warning} />
            <Text style={styles.outOfRangeTitle}>Out of Range</Text>
            <Text style={styles.outOfRangeText}>
              You need to be within 500m of passengers to open radar. Move closer to a stop.
            </Text>
            <TouchableOpacity
              style={styles.outOfRangeBtn}
              onPress={() => setShowOutOfRange(false)}
            >
              <Text style={styles.outOfRangeBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F4",
  },

  /* header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },

  /* distance card */
  distanceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  flagWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardDistance: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 2,
  },
  greenText: {
    color: COLORS.primary,
  },
  walkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  walkText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeActive: {
    backgroundColor: COLORS.primary + "15",
  },
  statusBadgeInactive: {
    backgroundColor: "#FEF3C7",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: COLORS.primary,
  },
  statusDotInactive: {
    backgroundColor: "#F59E0B",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusLabelActive: {
    color: COLORS.primary,
  },
  statusLabelInactive: {
    color: "#F59E0B",
  },

  /* map / radar */
  mapArea: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E8F0FE",
  },
  mapBg: {
    flex: 1,
    backgroundColor: "rgba(0, 152, 73, 0.04)",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0, 152, 73, 0.08)",
    top: "20%",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(0, 152, 73, 0.08)",
    left: "20%",
  },
  poiLabel: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  poiLabelText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
  },
  radarCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -36,
    marginTop: -36,
    alignItems: "center",
    justifyContent: "center",
  },
  radarOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0, 152, 73, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  radarInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  passengerDot: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },

  /* bottom panel */
  bottomPanel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  routeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  routeInfoText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
    flex: 1,
  },
  rangeNote: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  radarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  radarBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },
  radarBtnActive: {
    backgroundColor: "#00E676",
  },
  radarBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },

  /* confirm popup */
  outOfRangeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  outOfRangeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 320,
  },
  outOfRangeTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  outOfRangeText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
  },
  outOfRangeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginTop: 8,
  },
  outOfRangeBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
