import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  Linking,
} from "react-native";
import VayyMap from "../../shared/components/VayyMap";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";

import { ConfirmPopup } from "./ConfirmPopup";

const { width } = Dimensions.get("window");
const DESTINATION_THRESHOLD = 100;

export function RideStatsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [speed, setSpeed] = useState(24);
  const [remainingDistance, setRemainingDistance] = useState(800);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const destination = route?.params?.destination || "Charbagh Metro Gate 2";
  const eta = route?.params?.eta || "4";
  const distanceLeft = route?.params?.distance || "800";
  const [endRideCase, setEndRideCase] = useState("arrived");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  useEffect(() => {
    const interval = setInterval(() => {
      setSpeed(Math.floor(Math.random() * (28 - 22 + 1)) + 22);
      setRemainingDistance((d) => Math.max(0, d - Math.floor(Math.random() * 50 + 10)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function handleEndRideTap() {
    const hasReached = remainingDistance <= DESTINATION_THRESHOLD;
    setEndRideCase(hasReached ? "arrived" : "not_arrived");
    setShowEndConfirm(true);
  }

  function handleConfirmEndRide() {
    setShowEndConfirm(false);
    navigation.navigate("RideComplete");
  }

  function handleShareTrip() {
    setShowShareModal(true);
  }

  function handleEmergency() {
    setShowEmergencyModal(true);
  }

  const destinationLabel =
    remainingDistance >= 1000
      ? `${(remainingDistance / 1000).toFixed(1)} km`
      : `${remainingDistance} m`;

  const etaMinutes = Math.max(1, Math.round(remainingDistance / 200));

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
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          scrollEnabled
          zoomEnabled
          zoomControlEnabled
        />

        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.headerLeft}>
            {Platform.OS === "ios" && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <View style={styles.statusContainer}>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>Ride Active</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleShareTrip}>
              <Feather name="share" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleEmergency}>
              <MaterialIcons name="emergency" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.poiLabel}>
          <Ionicons name="train-outline" size={14} color="#60A5FA" />
          <Text style={styles.poiText}>{destination}</Text>
        </View>

        <View style={styles.destLabel}>
          <Ionicons name="location" size={18} color="#009849" />
          <Text style={styles.destLabelText}>
            Charbagh Metro{"\n"}Gate 2
          </Text>
          <View style={styles.labelArrow} />
        </View>

        <View style={styles.destMarkerOuter}>
          <View style={styles.destMarker}>
            <Ionicons name="flag" size={20} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.distanceCallout}>
          <Text style={styles.distanceCalloutValue}>{distanceLeft} m</Text>
          <Text style={styles.distanceCalloutLabel}>away</Text>
          <View style={styles.calloutArrow} />
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routeSegment1} />
          <View style={styles.routeSegment2} />
          <View style={styles.routeSegment3} />
          <View style={styles.routeMidDot} />
        </View>

        <View style={styles.bikeMarker}>
          <Text style={{ fontSize: 24 }}>🏍️</Text>
        </View>

        <TouchableOpacity style={styles.recenterBtn} onPress={zoomIn}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.recenterBtn} onPress={zoomOut}>
          <Text style={styles.zoomText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.recenterBtn}>
          <MaterialIcons name="my-location" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Ionicons name="location" size={24} color="#009849" />
            <Text style={styles.statLabel}>Pickup Stop</Text>
            <Text style={styles.statMainBold}>
            {destination}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Ionicons name="time-outline" size={24} color="#009849" />
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValueGreen}>{eta} <Text style={styles.smallUnit}>min</Text></Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Ionicons name="share-social-outline" size={24} color="#009849" />
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValueGreen}>{distanceLeft} <Text style={styles.smallUnit}>m</Text></Text>
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
          <Text style={styles.remainingValue}>{eta} min</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.endRideBtn}
          onPress={handleEndRideTap}
        >
          <Text style={styles.endRideBtnText}>End Ride</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showEndConfirm} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.endOverlay}>
          <View style={styles.endCard}>
            <View style={styles.endIconWrap}>
              <Ionicons
                name={endRideCase === "arrived" ? "flag" : "warning"}
                size={40}
                color={endRideCase === "arrived" ? "#009849" : "#F59E0B"}
              />
            </View>

            {endRideCase === "arrived" ? (
              <>
                <Text style={styles.endTitle}>Looks like you've reached your destination.</Text>
                <Text style={styles.endMessage}>End Ride?</Text>
                <View style={styles.endActions}>
                  <TouchableOpacity style={styles.endPrimaryBtn} onPress={handleConfirmEndRide}>
                    <Text style={styles.endPrimaryText}>End Ride</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.endSecondaryBtn} onPress={() => setShowEndConfirm(false)}>
                    <Text style={styles.endSecondaryText}>Continue Ride</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.endTitle}>You are still {destinationLabel} away from your destination.</Text>
                <Text style={styles.endMessage}>Are you sure you want to end the ride?</Text>
                <View style={styles.endActions}>
                  <TouchableOpacity style={[styles.endPrimaryBtn, styles.endDangerBtn]} onPress={handleConfirmEndRide}>
                    <Text style={styles.endPrimaryText}>End Ride Anyway</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.endSecondaryBtn} onPress={() => setShowEndConfirm(false)}>
                    <Text style={styles.endSecondaryText}>Continue Ride</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showShareModal} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.shareOverlay}>
          <View style={[styles.shareCard, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.shareHandle} />
            <Text style={styles.shareTitle}>Share Trip</Text>
            <Text style={styles.shareSub}>Let someone know your ride status</Text>

            <TouchableOpacity style={styles.shareOption}>
              <View style={[styles.shareIconWrap, { backgroundColor: "#25D366" }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareOptionText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption}>
              <View style={[styles.shareIconWrap, { backgroundColor: "#0084FF" }]}>
                <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareOptionText}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption}>
              <View style={[styles.shareIconWrap, { backgroundColor: "#6B7280" }]}>
                <Ionicons name="copy" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareOptionText}>Copy Trip Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareCloseBtn}
              onPress={() => setShowShareModal(false)}
            >
              <Text style={styles.shareCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEmergencyModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.emergencyOverlay}>
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyIconWrap}>
              <MaterialIcons name="emergency" size={48} color="#EF4444" />
            </View>
            <Text style={styles.emergencyTitle}>Emergency</Text>
            <Text style={styles.emergencySub}>Your location will be shared with emergency contacts.</Text>

            <TouchableOpacity
              style={styles.emergencyCallBtn}
              onPress={() => Linking.openURL("tel:112")}
            >
              <Ionicons name="call" size={22} color="#FFFFFF" />
              <Text style={styles.emergencyCallText}>Call 112</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emergencyContactBtn}
              onPress={() => Linking.openURL("tel:+919876543210")}
            >
              <Text style={styles.emergencyContactText}>Call Emergency Contact</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emergencyCloseBtn}
              onPress={() => setShowEmergencyModal(false)}
            >
              <Text style={styles.emergencyCloseText}>I'm Safe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00E676",
  },
  statusText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
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
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
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
  zoomText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
  endOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  endCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  endIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0FAF2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  endTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  endMessage: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  endActions: {
    width: "100%",
    gap: 10,
  },
  endPrimaryBtn: {
    height: 52,
    borderRadius: 18,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#009849",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  endDangerBtn: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  endPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  endSecondaryBtn: {
    height: 44,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  endSecondaryText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  shareCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 20,
  },
  shareHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },
  shareTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  shareSub: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  shareOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  shareIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  shareOptionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  shareCloseBtn: {
    height: 50,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  shareCloseText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7280",
  },
  emergencyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emergencyCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 25,
  },
  emergencyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emergencyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#EF4444",
    marginBottom: 8,
  },
  emergencySub: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emergencyCallBtn: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#EF4444",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emergencyCallText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  emergencyContactBtn: {
    width: "100%",
    height: 50,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  emergencyContactText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
  },
  emergencyCloseBtn: {
    marginTop: 16,
  },
  emergencyCloseText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
});
