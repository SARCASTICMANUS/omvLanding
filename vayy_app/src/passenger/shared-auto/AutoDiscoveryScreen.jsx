import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
  Image,
} from "react-native";
import VayyMap, { ViewAnnotation } from "../../shared/components/VayyMap";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { getNearbyVehicles } from "../../passenger/services/passengerService";
import { DEFAULT_CENTER as MAP_CENTER } from "../../constants/mapConfig";

const VAYY_PRIMARY = "#009849";
const AUTO_COLORS = [VAYY_PRIMARY, "#F59E0B", "#EF4444"];

export function AutoDiscoveryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [approachingAutos, setApproachingAutos] = useState([]);
  const [nearestDist, setNearestDist] = useState(null);
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
    const fetchAutos = async () => {
      try {
        const data = await getNearbyVehicles(MAP_CENTER.latitude, MAP_CENTER.longitude, "auto", 2000);
        const vehicles = Array.isArray(data) ? data : data?.results || data?.vehicles || [];
        const mapped = vehicles.map((v, i) => ({
          autoId: v.id || v.vehicle_id || String(i),
          vehicleNumber: v.vehicle_number || v.number || "—",
          distance: v.distance || v.distance_meters || 500,
          eta: v.eta || v.eta_minutes || 3,
          lat: v.lat || v.latitude || MAP_CENTER.latitude,
          lng: v.lng || v.longitude || MAP_CENTER.longitude,
        }));
        setApproachingAutos(mapped.length > 0 ? mapped : []);
        if (mapped.length > 0) setNearestDist(mapped[0].distance);
      } catch {
        setApproachingAutos([]);
      }
    };
    fetchAutos();
  }, []);

  useEffect(() => {
    if (nearestDist === null) return;
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
  }, [nearestDist !== null]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleRecenter = () => {
    if (!cameraRef.current) return;
    cameraRef.current.setStop({
      center: [MAP_CENTER.longitude, MAP_CENTER.latitude],
      zoom: 14,
      duration: 800,
    });
  };

  const handleBoardConfirm = () => {
    setShowBoardConfirm(false);
    navigation.replace('AutoRideActive');
  };

  const nearest = approachingAutos.length > 0 ? {
    ...approachingAutos[0],
    distance: nearestDist ?? approachingAutos[0].distance,
  } : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          ref={mapRef}
          cameraRef={cameraRef}
          initialRegion={{
            latitude: MAP_CENTER.latitude,
            longitude: MAP_CENTER.longitude,
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
                <View
                  style={[
                    styles.autoMarker,
                    isNearest && {
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      borderColor: "#FFB800",
                      borderWidth: 3,
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.autoMarkerInner,
                      isNearest && { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    <Image
                      source={require("../../../assets/vayyTopAuto.webp")}
                      style={{ width: isNearest ? 34 : 28, height: isNearest ? 34 : 28 }}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </View>
              </ViewAnnotation>
            );
          })}
        </VayyMap>

        <ScreenHeader
          absolute
          zIndex={20}
          title={searchStatus === "auto_assigned" ? "Auto Arrived!" : "Auto Found"}
          subtitle={
            searchStatus === "auto_assigned"
              ? "Board the Auto to start your ride"
              : "Your Auto is heading to the pickup stop"
          }
          onBack={() => navigation.goBack()}
        />

        <View style={styles.statusChip}>
          <View style={styles.statusDot} />
          <Text style={styles.statusChipText}>
            {nearestDist > 0
              ? `Nearest auto ${nearestDist}m away`
              : "Auto has arrived at the stop"}
          </Text>
        </View>

        <View style={[styles.floatingContainer, { top: insets.top + 88 }]}>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomIn}>
            <Ionicons name="add" size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatBtn} onPress={zoomOut}>
            <Ionicons name="remove" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.floatDivider} />
          <TouchableOpacity style={styles.floatBtn} onPress={handleRecenter}>
            <MaterialIcons name="my-location" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        {searchStatus === "auto_assigned" && nearestDist <= 0 ? (
          <View style={styles.foundCard}>
            <View style={styles.foundIconWrap}>
              <Ionicons name="checkmark-circle" size={48} color={VAYY_PRIMARY} />
            </View>
            <Text style={styles.foundTitle}>Auto Has Arrived</Text>
            <Text style={styles.foundSub}>{nearest.vehicleNumber} is at your stop</Text>
            <View style={styles.foundDetails}>
              <View style={styles.foundRow}>
                <Image
                  source={require("../../../assets/vayyFrontAuto.webp")}
                  style={{ width: 16, height: 16 }}
                  resizeMode="contain"
                />
                <Text style={styles.foundRowText}>{nearest.vehicleNumber}</Text>
              </View>
              <View style={styles.foundRow}>
                <Ionicons name="location" size={16} color={VAYY_PRIMARY} />
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
              <Ionicons name="radio" size={20} color={VAYY_PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={styles.radarTitle}>Auto Approaching</Text>
                <Text style={styles.radarSub}>
                  {approachingAutos.length} autos on route · Nearest is {nearestDist}m away
                </Text>
              </View>
            </View>

            <View style={styles.autoList}>
              {approachingAutos.map((auto, i) => {
                const isNearest = i === 0;
                const displayDist = isNearest ? nearestDist : auto.distance;
                const progress = Math.min(1, 1 - displayDist / auto.distance);
                return (
                  <View
                    key={auto.autoId}
                    style={[styles.autoRow, isNearest && styles.autoRowNearest]}
                  >
                    <View
                      style={[
                        styles.autoMarkerDot,
                        { backgroundColor: AUTO_COLORS[i] },
                        isNearest && styles.autoMarkerDotNearest,
                      ]}
                    >
                      <Image
                        source={require("../../../assets/vayyFrontAuto.webp")}
                        style={{ width: 18, height: 18 }}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.autoInfo}>
                      <View style={styles.autoHeader}>
                        <Text style={[styles.autoRowId, isNearest && styles.autoRowIdNearest]}>
                          {auto.vehicleNumber}
                          {isNearest && <Text style={styles.nearestTag}> · Nearest</Text>}
                        </Text>
                        <Text style={styles.autoDistVal}>
                          {displayDist > 0 ? `${displayDist} m` : "Arrived"}
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: AUTO_COLORS[i],
                              width: `${Math.max(0, Math.min(progress, 1) * 100)}%`,
                            },
                          ]}
                        />
                      </View>
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
              <Image
                source={require("../../../assets/vayyAutoBoarding.webp")}
                style={{ width: 120, height: 120 }}
                resizeMode="contain"
              />
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
  mapArea: { ...StyleSheet.absoluteFillObject, backgroundColor: "#F9FAFB" },
  mapBg: { ...StyleSheet.absoluteFillObject },
  statusChip: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00E676",
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  floatingContainer: {
    position: "absolute",
    right: 16,
    gap: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
  },
  floatBtn: { width: 48, height: 44, justifyContent: "center", alignItems: "center" },
  floatDivider: { height: 1, backgroundColor: "#F0F0F0", marginHorizontal: 12 },
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
    marginBottom: 16,
  },
  radarStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ECFAF1",
    borderRadius: 16,
    padding: 16,
  },
  radarTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  radarSub: { fontSize: 13, color: "#6B7280", fontWeight: "500", marginTop: 2 },
  autoList: { gap: 8, marginTop: 16 },
  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  autoRowNearest: {
    backgroundColor: "#ECFAF1",
    borderWidth: 1,
    borderColor: VAYY_PRIMARY,
  },
  autoMarkerDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  autoMarkerDotNearest: {
    borderColor: "#FFB800",
    borderWidth: 3,
  },
  autoInfo: { flex: 1, gap: 6 },
  autoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  autoRowId: { fontSize: 14, fontWeight: "700", color: "#111827" },
  autoRowIdNearest: { color: VAYY_PRIMARY },
  nearestTag: { fontSize: 12, fontWeight: "600", color: VAYY_PRIMARY },
  autoDistVal: { fontSize: 12, fontWeight: "700", color: VAYY_PRIMARY },
  autoRowEta: { fontSize: 13, fontWeight: "800", color: VAYY_PRIMARY },
  progressTrack: { height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  foundCard: { alignItems: "center", paddingVertical: 8 },
  foundIconWrap: { marginBottom: 12 },
  foundTitle: { fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 4 },
  foundSub: { fontSize: 14, color: "#6B7280", fontWeight: "500", marginBottom: 20 },
  foundDetails: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  foundRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  foundRowText: { fontSize: 15, fontWeight: "700", color: "#111827" },
  boardBtn: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    backgroundColor: VAYY_PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: VAYY_PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  boardBtnText: { fontSize: 17, fontWeight: "900", color: "#FFFFFF" },

  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    width: 120,
    height: 120,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 8 },
  modalMessage: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalBtnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnSecondaryText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  modalBtnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: VAYY_PRIMARY,
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  autoMarkerInner: {
    justifyContent: "center",
    alignItems: "center",
  },
});
