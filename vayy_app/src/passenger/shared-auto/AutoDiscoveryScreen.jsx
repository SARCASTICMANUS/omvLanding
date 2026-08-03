import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
} from "react-native";
import VayyMap, { ViewAnnotation } from "../../shared/components/VayyMap";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const AUTO_COLORS = ["#009849", "#F59E0B", "#EF4444"];

const MOCK_AUTOS = [
  { autoId: "1", vehicleNumber: "UP32 AB 1234", distance: 240, eta: 2, lat: 26.8500, lng: 80.9500 },
  { autoId: "2", vehicleNumber: "UP32 CD 5678", distance: 520, eta: 4, lat: 26.8550, lng: 80.9550 },
  { autoId: "3", vehicleNumber: "UP32 EF 9012", distance: 780, eta: 6, lat: 26.8600, lng: 80.9600 },
];

export function AutoDiscoveryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [approachingAutos] = useState(MOCK_AUTOS);
  const [nearestDist, setNearestDist] = useState(MOCK_AUTOS[0].distance);
  const [searchStatus, setSearchStatus] = useState("autos_found");
  const [showBoardConfirm, setShowBoardConfirm] = useState(false);
  const arrivedRef = useRef(false);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNearestDist((prev) => {
        const next = Math.max(0, prev - 25);
        if (next <= 0 && !arrivedRef.current) {
          arrivedRef.current = true;
          clearInterval(interval);
          setSearchStatus("auto_assigned");
          setTimeout(() => setShowBoardConfirm(true), 600);
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleBoardConfirm = () => {
    setShowBoardConfirm(false);
    navigation.replace('AutoRideActive');
  };

  const nearest = {
    ...MOCK_AUTOS[0],
    distance: nearestDist,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          ref={mapRef}
          cameraRef={cameraRef}
          initialRegion={{
            latitude: 26.8467,
            longitude: 80.9462,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          scrollEnabled={true}
          zoomEnabled={true}
        >
          {approachingAutos.map((auto, i) => {
            const isNearest = i === 0;
            return (
              <ViewAnnotation
                key={auto.autoId}
                id={`auto-${auto.autoId}`}
                lngLat={[auto.lng, auto.lat]}
              >
                <Animated.View
                  style={[
                    styles.autoMarker,
                    { backgroundColor: AUTO_COLORS[i] },
                    isNearest && {
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      borderColor: "#FFB800",
                      borderWidth: 3,
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  <Text style={{ fontSize: isNearest ? 20 : 16 }}>🛺</Text>
                </Animated.View>
              </ViewAnnotation>
            );
          })}
        </VayyMap>

        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.headerLeft}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>
              {searchStatus === "auto_assigned" ? "Arrived!" : "Auto Radar"}
            </Text>
          </View>
        </View>

        <View style={styles.statusChip}>
          <View style={styles.statusDot} />
          <Text style={styles.statusChipText}>
            {nearestDist > 0
              ? `Nearest auto ${nearestDist}m away`
              : "Auto has arrived"}
          </Text>
        </View>

        <View style={styles.floatingContainer}>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomOut}>
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        {searchStatus === "auto_assigned" && nearestDist <= 0 ? (
          <View style={styles.foundCard}>
            <View style={styles.foundIconWrap}>
              <Ionicons name="checkmark-circle" size={48} color="#009849" />
            </View>
            <Text style={styles.foundTitle}>Auto Has Arrived</Text>
            <Text style={styles.foundSub}>{nearest.vehicleNumber} is at your stop</Text>
            <View style={styles.foundDetails}>
              <View style={styles.foundRow}>
                <Ionicons name="car" size={16} color="#009849" />
                <Text style={styles.foundRowText}>{nearest.vehicleNumber}</Text>
              </View>
              <View style={styles.foundRow}>
                <Ionicons name="location" size={16} color="#009849" />
                <Text style={styles.foundRowText}>At your stop</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.boardBtn}
              onPress={() => setShowBoardConfirm(true)}
            >
              <Text style={styles.boardBtnText}>Tap To Board</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.radarStatus}>
              <Ionicons name="radio" size={20} color="#009849" />
              <View style={{ flex: 1 }}>
                <Text style={styles.radarTitle}>Auto Radar Active</Text>
                <Text style={styles.radarSub}>
                  {approachingAutos.length} autos on route · Nearest is {nearestDist}m away
                </Text>
              </View>
            </View>

            <View style={styles.autoList}>
              {approachingAutos.map((auto, i) => {
                const isNearest = i === 0;
                return (
                  <View
                    key={auto.autoId}
                    style={[styles.autoRow, isNearest && styles.autoRowNearest]}
                  >
                    <View style={[styles.autoMarkerDot, { backgroundColor: AUTO_COLORS[i] }, isNearest && styles.autoMarkerDotNearest]}>
                      <Text style={styles.autoMarkerEmoji}>🛺</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.autoRowId, isNearest && styles.autoRowIdNearest]}>
                        {auto.vehicleNumber}
                        {isNearest && <Text style={styles.nearestTag}> · Nearest</Text>}
                      </Text>
                      <Text style={styles.autoRowDist}>{auto.distance}m away</Text>
                    </View>
                    <Text style={styles.autoRowEta}>{auto.eta} min</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {showBoardConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="car" size={40} color="#009849" />
            </View>
            <Text style={styles.modalTitle}>Boarded The Auto?</Text>
            <Text style={styles.modalMessage}>
              Confirm that you have boarded {nearest.vehicleNumber}.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowBoardConfirm(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Not Yet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={handleBoardConfirm}
              >
                <Text style={styles.modalBtnPrimaryText}>Yes, I'm On Board</Text>
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
    paddingHorizontal: 24, paddingBottom: 12,
    backgroundColor: "rgba(0,152,73,0.6)", overflow: "hidden",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5 },
  iconBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "#FFFFFF",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  mapArea: { ...StyleSheet.absoluteFillObject, backgroundColor: "#F9FAFB" },
  mapBg: { ...StyleSheet.absoluteFillObject },
  floatingContainer: { position: "absolute", right: 20, bottom: 100, gap: 12 },
  floatBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFFFFF",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  zoomText: { fontSize: 22, fontWeight: "600", color: "#111827", lineHeight: 24 },
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
  radarStatus: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#ECFAF1", borderRadius: 16, padding: 16,
  },
  radarTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  radarSub: { fontSize: 13, color: "#6B7280", fontWeight: "500", marginTop: 2 },
  statusChip: {
    position: "absolute", top: 100, left: 20, right: 20, zIndex: 10,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFFFF", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 15, elevation: 4,
  },
  statusDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#00E676",
  },
  statusChipText: {
    fontSize: 14, fontWeight: "700", color: "#111827", flex: 1,
  },
  autoList: { gap: 8, marginTop: 16 },
  autoRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, gap: 12,
  },
  autoRowNearest: {
    backgroundColor: "#ECFAF1", borderWidth: 1, borderColor: "#009849",
  },
  autoMarkerDot: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#FFFFFF",
  },
  autoMarkerDotNearest: {
    borderColor: "#FFB800", borderWidth: 3,
  },
  autoMarkerEmoji: { fontSize: 16 },
  autoRowId: { fontSize: 14, fontWeight: "700", color: "#111827" },
  autoRowIdNearest: { color: "#009849" },
  nearestTag: { fontSize: 12, fontWeight: "600", color: "#009849" },
  autoRowDist: { fontSize: 12, color: "#6B7280", fontWeight: "500", marginTop: 1 },
  autoRowEta: { fontSize: 13, fontWeight: "800", color: "#009849" },
  foundCard: { alignItems: "center", paddingVertical: 8 },
  foundIconWrap: { marginBottom: 12 },
  foundTitle: { fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 4 },
  foundSub: { fontSize: 14, color: "#6B7280", fontWeight: "500", marginBottom: 20 },
  foundDetails: {
    width: "100%", backgroundColor: "#F9FAFB", borderRadius: 16, padding: 16, gap: 12, marginBottom: 20,
  },
  foundRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  foundRowText: { fontSize: 15, fontWeight: "700", color: "#111827" },
  boardBtn: {
    width: "100%", height: 56, borderRadius: 18, backgroundColor: "#009849",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#009849", shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  boardBtnText: { fontSize: 17, fontWeight: "900", color: "#FFFFFF" },
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
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 8 },
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

  autoMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
});
