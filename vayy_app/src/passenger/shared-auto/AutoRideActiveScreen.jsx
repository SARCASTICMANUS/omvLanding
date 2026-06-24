import React, { useEffect, useRef, useState } from "react";
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
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export function AutoRideActiveScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [remainingDistance] = useState(2400);
  const [remainingEta] = useState(12);
  const [speed] = useState(24);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEarlyEnd, setShowEarlyEnd] = useState(false);
  const atDestination = remainingDistance <= 100;

  const zoomIn = () => {
    mapRef.current?.animateCamera({ zoom: 16 });
  };

  const zoomOut = () => {
    mapRef.current?.animateCamera({ zoom: 12 });
  };

  const handleEndRide = () => {
    if (remainingDistance <= 100) {
      setShowEndConfirm(true);
    } else {
      setShowEarlyEnd(true);
    }
  };

  const confirmEndRide = () => {
    setShowEndConfirm(false);
    navigation.replace('AutoRideComplete');
  };

  const confirmEarlyEnd = () => {
    setShowEarlyEnd(false);
    navigation.replace('AutoRideComplete');
  };

  const progress = Math.max(0, Math.min(100, ((10000 - remainingDistance) / 10000) * 100));

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
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
          zoomControlEnabled={true}
        />

        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.headerLeft}>
            <View style={styles.statusContainer}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>On the way</Text>
            </View>
          </View>
        </View>

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
        </View>

        <View style={styles.destLabel}>
          <Ionicons name="location" size={16} color="#009849" />
          <Text style={styles.destLabelText}>Charbagh Metro Gate 2</Text>
        </View>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Route Progress</Text>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="speedometer" size={20} color="#009849" />
            <Text style={styles.statValue}>{speed}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="location" size={20} color="#009849" />
            <Text style={styles.statValue}>{(remainingDistance / 1000).toFixed(1)}</Text>
            <Text style={styles.statLabel}>km left</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Ionicons name="time-outline" size={20} color="#009849" />
            <Text style={styles.statValue}>{remainingEta}</Text>
            <Text style={styles.statLabel}>min left</Text>
          </View>
        </View>

        <View style={styles.nextStopCard}>
          <Ionicons name="flag" size={16} color="#009849" />
          <Text style={styles.nextStopText}>
            Next stop: <Text style={styles.nextStopBold}>Hazratganj Metro Gate 2</Text>
          </Text>
        </View>

        <TouchableOpacity style={styles.endRideBtn} onPress={handleEndRide}>
          <Ionicons name="stop-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.endRideText}>End Ride</Text>
        </TouchableOpacity>
      </View>

      {showEndConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color="#009849" />
            </View>
            <Text style={styles.modalTitle}>End Ride?</Text>
            <Text style={styles.modalMessage}>
              Looks like you've reached your destination.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowEndConfirm(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={confirmEndRide}
              >
                <Text style={styles.modalBtnPrimaryText}>End Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showEarlyEnd && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconWrap, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="warning-outline" size={40} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>You Have Not Reached Your Destination</Text>
            <Text style={styles.modalMessage}>
              You are still {(remainingDistance / 1000).toFixed(1)} km away from your selected destination.{'\n\n'}
              Are you sure you want to end this ride?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowEarlyEnd(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Continue Ride</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: "#EF4444" }]}
                onPress={confirmEarlyEnd}
              >
                <Text style={styles.modalBtnPrimaryText}>End Ride Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", backgroundColor: "#F8FAF9" },
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: "rgba(0,152,73,0.6)", overflow: "hidden",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#00E676" },
  statusText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  iconBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "#FFFFFF",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  mapArea: { ...StyleSheet.absoluteFillObject, backgroundColor: "#F9FAFB" },
  mapBg: { ...StyleSheet.absoluteFillObject },
  floatingContainer: { position: "absolute", right: 20, bottom: 30, gap: 12 },
  floatBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFFFFF",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  zoomText: { fontSize: 22, fontWeight: "600", color: "#111827", lineHeight: 24 },
  destLabel: {
    position: "absolute", bottom: 120, left: 20,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  destLabelText: { fontSize: 13, fontWeight: "700", color: "#111827" },
  bottomSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 15,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB",
    alignSelf: "center", marginBottom: 20,
  },
  progressSection: { marginBottom: 16 },
  progressHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
  },
  progressTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  progressPercent: { fontSize: 15, fontWeight: "800", color: "#009849" },
  progressBar: {
    width: "100%", height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#009849", borderRadius: 3 },
  statsRow: {
    flexDirection: "row", backgroundColor: "#F9FAFB", borderRadius: 16,
    padding: 16, marginBottom: 16, alignItems: "center",
  },
  statCol: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 22, fontWeight: "900", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  statDivider: { width: 1, height: 32, backgroundColor: "#E5E7EB" },
  nextStopCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ECFAF1", borderRadius: 12, padding: 12, marginBottom: 16,
  },
  nextStopText: { fontSize: 13, color: "#374151", fontWeight: "500", flex: 1 },
  nextStopBold: { fontWeight: "800", color: "#111827" },
  endRideBtn: {
    height: 56, borderRadius: 18, backgroundColor: "#EF4444",
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
    shadowColor: "#EF4444", shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  endRideText: { fontSize: 17, fontWeight: "900", color: "#FFFFFF" },
  modalOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center",
    zIndex: 100, paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24,
    width: "100%", maxWidth: 340, alignItems: "center",
  },
  modalIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#ECFAF1",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 8, textAlign: "center" },
  modalMessage: {
    fontSize: 14, color: "#6B7280", fontWeight: "500", textAlign: "center",
    lineHeight: 20, marginBottom: 24,
  },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtnSecondary: {
    flex: 1, height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: "#E5E7EB",
    justifyContent: "center", alignItems: "center",
  },
  modalBtnSecondaryText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  modalBtnPrimary: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: "#009849",
    justifyContent: "center", alignItems: "center",
  },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
});
