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

import { ConfirmPopup } from "./ConfirmPopup";

const { width } = Dimensions.get("window");

export function BikeMapPreRideScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Bike pickup</Text>
        </View>

        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="more-vert" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Top Distance Card */}
      <View style={styles.distanceCard}>
        <View style={styles.flagWrapper}>
          <Ionicons name="flag" size={24} color="#009849" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Nearest stop</Text>
          <Text style={styles.cardDistance}>
            <Text style={styles.greenText}>200 m</Text> away
          </Text>
        </View>
        <View style={styles.etaBadge}>
          <Text style={styles.etaBadgeValue}>~2 min</Text>
          <Text style={styles.etaBadgeLabel}>wait</Text>
        </View>
      </View>

      {/* Map Area */}
      <View style={styles.mapArea}>
        {/* Simplified Map Background with subtle grid lines */}
        <View style={styles.mapBg}>
          <View style={styles.gridLineH} />
          <View style={[styles.gridLineH, { top: "40%" }]} />
          <View style={[styles.gridLineH, { top: "70%" }]} />
          <View style={styles.gridLineV} />
          <View style={[styles.gridLineV, { left: "40%" }]} />
          <View style={[styles.gridLineV, { left: "70%" }]} />
        </View>

        {/* Charbagh Label */}
        <View style={styles.poiLabel}>
          <Ionicons name="train-outline" size={14} color="#60A5FA" />
          <Text style={styles.poiText}>Charbagh</Text>
        </View>

        {/* Stop Label with Arrow */}
        <View style={styles.stopLabel}>
          <Text style={styles.stopLabelText}>
            Hazratganj{"\n"}Metro Gate 2
          </Text>
          <View style={styles.labelArrow} />
        </View>

        {/* Stop Marker */}
        <View style={styles.stopMarkerOuter}>
          <View style={styles.stopMarker}>
            <Ionicons name="flag" size={20} color="#FFFFFF" />
          </View>
        </View>

        {/* Route Path (Solid Green) */}
        <View style={styles.routeContainer}>
          <View style={styles.routeSegment1} />
          <View style={styles.routeSegment2} />
          <View style={styles.routeSegment3} />
          <View style={styles.routeMidDot} />
        </View>

        {/* Bike Marker */}
        <View style={styles.bikeMarker}>
          <Text style={{ fontSize: 24 }}>🏍️</Text>
        </View>

        {/* Live Bikes on Route Chip */}
        <View style={styles.liveBikesChip}>
          <View style={styles.liveDot} />
          <Ionicons name="bicycle" size={16} color="#009849" />
          <Text style={styles.liveBikesText}>3 bikes on route</Text>
        </View>

        {/* Floating Buttons */}
        <View style={styles.floatingContainer}>
          <TouchableOpacity style={styles.floatBtn}>
            <MaterialIcons name="my-location" size={24} color="#111827" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.floatBtn}>
            <Feather name="navigation" size={24} color="#009849" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="location" size={24} color="#009849" />
            <Text style={styles.statLabel}>Nearest stop</Text>
            <Text style={styles.statMainBold}>
              Hazratganj{"\n"}Metro Gate 2
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Ionicons name="walk" size={24} color="#009849" />
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValueGreen}>200 <Text style={styles.smallUnit}>m</Text></Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Ionicons name="time-outline" size={24} color="#009849" />
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValueGreen}>2 <Text style={styles.smallUnit}>min</Text></Text>
          </View>
        </View>

        <TouchableOpacity 
          activeOpacity={0.9} 
          style={styles.raiseBtn}
          onPress={() => setShowConfirm(true)}
        >
          <Text style={styles.raiseText}>✋  Raise Hand at Stop</Text>
        </TouchableOpacity>
      </View>

      <ConfirmPopup
        visible={showConfirm}
        title="Raise Hand at Stop?"
        message="Are you at Hazratganj Metro Gate 2? Nearby riders will be notified."
        confirmLabel="Yes, Raise Hand"
        icon="hand-left-outline"
        onConfirm={() => {
          setShowConfirm(false);
          navigation.navigate('BikeSearching');
        }}
        onCancel={() => setShowConfirm(false)}
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
  etaBadge: {
    backgroundColor: "#ECFAF1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  etaBadgeValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#009849",
  },
  etaBadgeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
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
  stopLabel: {
    position: "absolute",
    top: 100,
    right: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stopLabelText: {
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
  stopMarkerOuter: {
    position: "absolute",
    top: 95,
    right: 55,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,152,73,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  stopMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  routeContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  routeSegment1: {
    position: "absolute",
    top: 160,
    right: 80,
    width: 4,
    height: 120,
    backgroundColor: "#009849",
    borderRadius: 2,
  },
  routeSegment2: {
    position: "absolute",
    top: 275,
    right: 80,
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
  bikeMarker: {
    position: "absolute",
    bottom: 180,
    left: "38%",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  liveBikesChip: {
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
  liveBikesText: {
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
  statsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#F3F4F6",
    marginHorizontal: 4,
  },
  statLabel: {
    color: "#888888",
    fontSize: 13,
    fontWeight: "500",
    textAlign: 'center',
  },
  statMainBold: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    color: "#111827",
    lineHeight: 20,
  },
  statValueGreen: {
    fontSize: 22,
    fontWeight: "800",
    color: "#009849",
  },
  smallUnit: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
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
  raiseText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});
