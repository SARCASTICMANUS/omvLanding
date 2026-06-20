import React, { useEffect, useState } from "react";
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
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";

import { ConfirmPopup } from "./ConfirmPopup";

const { width } = Dimensions.get("window");

export function RideStatsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [speed, setSpeed] = useState(24);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpeed(Math.floor(Math.random() * (28 - 22 + 1)) + 22);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <View style={styles.statusContainer}>
            {/* <Ionicons name="ellipse" size={8} color="#009849" /> */}
            <Text style={styles.statusText}>On the way to destination</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="more-vert" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Map Area */}
      <View style={styles.mapArea}>
        <View style={styles.mapBg}>
          {/* subtle grid lines */}
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

        {/* Destination Label */}
        <View style={styles.destLabel}>
          <Ionicons name="location" size={18} color="#009849" />
          <Text style={styles.destLabelText}>
            Charbagh Metro{"\n"}Gate 2
          </Text>
          <View style={styles.labelArrow} />
        </View>

        {/* Destination Marker */}
        <View style={styles.destMarkerOuter}>
          <View style={styles.destMarker}>
            <Ionicons name="flag" size={20} color="#FFFFFF" />
          </View>
        </View>

        {/* Distance Callout */}
        <View style={styles.distanceCallout}>
          <Text style={styles.distanceCalloutValue}>800 m</Text>
          <Text style={styles.distanceCalloutLabel}>away</Text>
          <View style={styles.calloutArrow} />
        </View>

        {/* Route Path */}
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

        {/* Recenter Button */}
        <TouchableOpacity style={styles.recenterBtn}>
          <MaterialIcons name="my-location" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="location" size={24} color="#009849" />
            <Text style={styles.statLabel}>Pickup Stop</Text>
            <Text style={styles.statMainBold}>
              Charbagh Metro{"\n"}Gate 2
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Ionicons name="time-outline" size={24} color="#009849" />
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValueGreen}>3 <Text style={styles.smallUnit}>min</Text></Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Ionicons name="share-social-outline" size={24} color="#009849" />
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValueGreen}>800 <Text style={styles.smallUnit}>m</Text></Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <MaterialCommunityIcons name="speedometer" size={24} color="#009849" />
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValueGreen}>{speed} <Text style={styles.smallUnit}>km/h</Text></Text>
          </View>
        </View>

        <View style={styles.remainingRow}>
          <Ionicons name="location" size={16} color="#009849" />
          <Text style={styles.remainingLabel}>Arriving at destination in</Text>
          <Text style={styles.remainingValue}>4 min</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.endRideBtn}
          onPress={() => setShowEndConfirm(true)}
        >
          <Text style={styles.endRideBtnText}>End Ride</Text>
        </TouchableOpacity>
      </View>

      <ConfirmPopup
        visible={showEndConfirm}
        title="End Ride?"
        message="Make sure you've reached your destination before ending the ride."
        confirmLabel="Yes, End Ride"
        icon="flag-outline"
        onConfirm={() => {
          setShowEndConfirm(false);
          navigation.navigate('RideComplete');
        }}
        onCancel={() => setShowEndConfirm(false)}
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.4,
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
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  cancelText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
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
  destLabel: {
    position: "absolute",
    top: 80,
    right: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  destLabelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 18,
  },
  labelArrow: {
    position: "absolute",
    bottom: -6,
    left: "50%",
    width: 12,
    height: 12,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }, { translateX: -6 }],
  },
  destMarkerOuter: {
    position: "absolute",
    top: 140,
    right: 90,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,152,73,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  destMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  distanceCallout: {
    position: "absolute",
    bottom: "45%",
    left: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#009849",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  distanceCalloutValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#009849",
  },
  distanceCalloutLabel: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
  },
  calloutArrow: {
    position: "absolute",
    bottom: -8,
    left: "30%",
    width: 14,
    height: 14,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "#009849",
    transform: [{ rotate: "45deg" }],
  },
  routeContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  routeSegment1: {
    position: "absolute",
    top: 180,
    right: 105,
    width: 4,
    height: 100,
    backgroundColor: "#009849",
    borderRadius: 2,
  },
  routeSegment2: {
    position: "absolute",
    top: 275,
    right: 105,
    width: 110,
    height: 4,
    backgroundColor: "#009849",
    transform: [{ rotate: "45deg" }, { translateX: -35 }],
    borderRadius: 2,
  },
  routeSegment3: {
    position: "absolute",
    top: 380,
    left: "35%",
    width: 4,
    height: 100,
    backgroundColor: "#009849",
    borderRadius: 2,
  },
  routeMidDot: {
    position: "absolute",
    top: 360,
    left: "34.5%",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#009849",
  },
  bikeMarker: {
    position: "absolute",
    bottom: "22%",
    left: "25%",
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
  recenterBtn: {
    position: "absolute",
    right: 20,
    bottom: 30,
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
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#F3F4F6",
    marginHorizontal: 2,
  },
  statLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  statMainBold: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    color: "#111827",
    lineHeight: 18,
  },
  statValueGreen: {
    fontSize: 20,
    fontWeight: "800",
    color: "#009849",
  },
  smallUnit: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
  },
  remainingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
    marginTop: 8,
  },
  remainingLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  remainingValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#009849",
  },
  endRideBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  endRideBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
});
