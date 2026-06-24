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
  Animated,
  Easing,
} from "react-native";
import MapView from "react-native-maps";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";

import { ConfirmPopup } from "./ConfirmPopup";

const { width } = Dimensions.get("window");

export function RiderArrivingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [step, setStep] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const [modalPhase, setModalPhase] = useState("waiting");
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const otpDigits = ["2", "7", "4", "1"];

  const distanceSteps = [400, 250, 150, 100, 50, 0, 0, 0];
  const etaSteps = ["5 min", "3 min", "2 min", "1 min", "30 sec", "Arrived", "Arrived", "Arrived"];
  const currentDistance = distanceSteps[step];
  const currentEta = etaSteps[step];
  const hasArrived = currentDistance === 0;

  const zoomIn = () => mapRef.current?.animateCamera({ zoom: 16 });
  const zoomOut = () => mapRef.current?.animateCamera({ zoom: 12 });

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((v) => {
        const next = v + 1;
        if (next >= distanceSteps.length) {
          clearInterval(timer);
          return v;
        }
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (hasArrived) {
      setShowArrivedModal(true);
      setModalPhase("waiting");

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();

      setTimeout(() => {
        pulseAnim.stopAnimation();
        setModalPhase("verified");
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 40,
          friction: 5,
          useNativeDriver: true,
        }).start();
        setTimeout(() => {
          setShowArrivedModal(false);
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            navigation.replace("RideStats");
          });
        }, 2000);
      }, 8000);
    }
  }, [hasArrived]);

  function handleCallRider() {
    Linking.openURL("tel:+919876543210");
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOpacity }]}>
        <MapView
          style={styles.mapBg}
          ref={mapRef}
          initialRegion={{
            latitude: 26.8467,
            longitude: 80.9462,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          scrollEnabled
          zoomEnabled
          zoomControlEnabled
        />
      </Animated.View>

      <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.headerLeft}>
            {Platform.OS === "ios" && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Rider Arriving</Text>
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCancelConfirm(true)}>
            <Text style={styles.cancelText}>Cancel</Text>
            <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.riderCallout}>
          <View style={styles.calloutBox}>
            <Text style={styles.calloutValue}>{currentEta}</Text>
            <Text style={styles.calloutLabel}>to pickup</Text>
          </View>
          <View style={styles.calloutArrow} />
          <View style={styles.riderIconCircle}>
            <Text style={{ fontSize: 24 }}>🏍️</Text>
          </View>
        </View>

        <View style={styles.userMarkerOuter}>
          <View style={styles.userMarker}>
            <View style={styles.userDot} />
          </View>
          <View style={styles.markerLabel}>
            <Text style={styles.markerLabelText}>You</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.zoomBtnTop} onPress={zoomIn}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtnBottom} onPress={zoomOut}>
          <Text style={styles.zoomText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.recenterBtn}>
          <MaterialIcons name="my-location" size={24} color="#111827" />
        </TouchableOpacity>
      </Animated.View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        <View style={styles.riderRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>P</Text>
            <View style={styles.badge}>
              <Ionicons name="star" size={10} color="#FFB800" />
              <Text style={styles.ratingText}>4.9</Text>
            </View>
          </View>
          <View style={styles.riderDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.riderName}>Priya Sharma</Text>
              <MaterialIcons name="verified" size={16} color="#009849" />
            </View>
            <Text style={styles.vehicleInfo}>Royal Enfield Classic • UP 32 AZ 1234</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={handleCallRider}>
            <Ionicons name="call" size={22} color="#009849" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.distanceProgressRow}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Rider is</Text>
            <Text style={styles.progressDistance}>{currentDistance} m away</Text>
          </View>
          <Text style={styles.progressEta}>{currentEta}</Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(100, (currentDistance > 0 ? 1 - currentDistance / 400 : 1) * 100)}%` },
            ]}
          />
        </View>
      </View>

      <Modal visible={showArrivedModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.arrivedOverlay}>
          <View style={styles.arrivedCard}>
            {modalPhase === "waiting" ? (
              <>
                <View style={styles.waitingIconWrap}>
                  <Animated.View style={[styles.pulseRing, { opacity: pulseAnim }]} />
                  <View style={styles.waitingIconInner}>
                    <Ionicons name="bicycle" size={36} color="#009849" />
                  </View>
                </View>
                <Text style={styles.arrivedTitle}>Your Rider Has Arrived</Text>

                <View style={[styles.riderRow, { marginBottom: 24 }]}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitial}>P</Text>
                  </View>
                  <View style={styles.riderDetails}>
                    <Text style={styles.riderName}>Priya Sharma</Text>
                    <Text style={styles.vehicleInfo}>Royal Enfield Classic</Text>
                  </View>
                </View>

                <Text style={styles.arrivedOtpLabel}>Share this OTP with your rider</Text>
                <View style={styles.arrivedOtpRow}>
                  {otpDigits.map((d, i) => (
                    <View key={i} style={styles.arrivedOtpBox}>
                      <Text style={styles.arrivedOtpDigit}>{d}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.waitingRow}>
                  <Animated.View style={[styles.waitingDot, { opacity: pulseAnim }]} />
                  <Text style={styles.arrivedWaitText}>Waiting for OTP verification...</Text>
                </View>

                <TouchableOpacity style={styles.arrivedCallBtn} onPress={handleCallRider}>
                  <Ionicons name="call" size={20} color="#009849" />
                  <Text style={styles.arrivedCallText}>Call Rider</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Animated.View style={[styles.verifiedCircle, { transform: [{ scale: checkScale }] }]}>
                  <Ionicons name="checkmark" size={48} color="#FFFFFF" />
                </Animated.View>
                <Text style={styles.verifiedTitle}>OTP Verified!</Text>
                <Text style={styles.verifiedSub}>Starting your ride...</Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      <ConfirmPopup
        visible={showCancelConfirm}
        title="Cancel Ride?"
        message="Your ride with Priya Sharma will be cancelled."
        confirmLabel="Yes, Cancel"
        confirmColor="#EF4444"
        icon="close-circle-outline"
        onConfirm={() => {
          setShowCancelConfirm(false);
          navigation.goBack();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />
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
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F9FAFB",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  riderCallout: {
    position: "absolute",
    bottom: "35%",
    left: "20%",
    alignItems: "center",
  },
  calloutBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "#009849",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  calloutValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#009849",
  },
  calloutLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
  },
  calloutArrow: {
    width: 10,
    height: 10,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "#009849",
    transform: [{ rotate: "45deg" }],
    marginTop: -5,
  },
  riderIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  userMarkerOuter: {
    position: "absolute",
    bottom: "42%",
    right: "25%",
    alignItems: "center",
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  userDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  markerLabel: {
    backgroundColor: "#111827",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  markerLabelText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  zoomBtnTop: {
    position: "absolute",
    right: 20,
    bottom: 100,
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
  zoomBtnBottom: {
    position: "absolute",
    right: 20,
    bottom: 156,
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
  zoomText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
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
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: "800",
    color: "#009849",
  },
  badge: {
    position: "absolute",
    bottom: -4,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 2,
  },
  riderDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  riderName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  vehicleInfo: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0FAF2",
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 18,
  },
  distanceProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressInfo: {},
  progressLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  progressDistance: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginTop: 2,
  },
  progressEta: {
    fontSize: 18,
    fontWeight: "800",
    color: "#009849",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#009849",
  },
  arrivedOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  arrivedCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 25,
  },
  waitingIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  pulseRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(0,152,73,0.15)",
  },
  waitingIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0FAF2",
    justifyContent: "center",
    alignItems: "center",
  },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  waitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#009849",
  },
  arrivedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 24,
    textAlign: "center",
  },
  arrivedOtpLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 12,
  },
  arrivedOtpRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  arrivedOtpBox: {
    width: 52,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#F0FAF2",
    borderWidth: 2,
    borderColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  arrivedOtpDigit: {
    fontSize: 24,
    fontWeight: "800",
    color: "#009849",
  },
  arrivedWaitText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  verifiedCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#009849",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  verifiedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  verifiedSub: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  arrivedCallBtn: {
    width: "100%",
    height: 52,
    borderRadius: 18,
    backgroundColor: "#F0FAF2",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  arrivedCallText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#009849",
  },
});
