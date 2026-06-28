import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Image,
} from "react-native";
import VayyMap from "../../shared/components/VayyMap";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
  Feather,
} from "@expo/vector-icons";

import { ConfirmPopup } from "./ConfirmPopup";

const { width } = Dimensions.get("window");

export function BikeMapPostAcceptScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const driverName = route?.params?.driverName || "Priya Sharma";
  const vehicle = route?.params?.vehicle || "Royal Enfield Classic • UP 32 AZ 1234";
  const otpDigits = route?.params?.otp ? String(route.params.otp).split("") : ["2","7","4","1"];
  const labels = route?.params?.distanceLabels || ["1.2 km", "800 m", "400 m"];
  const etas = route?.params?.etaLabels || ["5 min", "3 min", "2 min"];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((v) => (v + 1) % labels.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Map Area */}
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
          scrollEnabled={true}
          zoomEnabled={true}
          zoomControlEnabled={true}
        />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>Driver arriving</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCancelConfirm(true)}>
            <Text style={styles.cancelText}>Cancel</Text>
            <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Pickup Marker */}
        <View style={styles.pickupMarkerOuter}>
          <View style={styles.pickupMarker}>
            <Ionicons name="pin" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.markerLabel}>
            <Text style={styles.markerLabelText}>You are here</Text>
          </View>
        </View>

        {/* Driver Tracking Callout */}
        <View style={[styles.driverCallout, { bottom: 200 + step * 40, left: 60 + step * 30 }]}>
          <View style={styles.calloutBox}>
            <Text style={styles.calloutValue}>{labels[step]}</Text>
            <Text style={styles.calloutLabel}>away</Text>
          </View>
          <View style={styles.calloutArrow} />
          <View style={styles.driverDot}>
            <Text style={{ fontSize: 20 }}>🏍️</Text>
          </View>
        </View>

        {/* Route Line (Dynamic feel) */}
        <View style={styles.routeContainer}>
            <View style={[styles.routePath, { width: 150 - step * 30, height: 180 - step * 30 }]} />
        </View>

        {/* Floating Buttons */}
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

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />

        {/* Driver Profile Row */}
        <View style={styles.driverRow}>
          <View style={styles.avatarContainer}>
             <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{driverName.charAt(0)}</Text>
             </View>
             <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#FFB800" />
                <Text style={styles.ratingText}>4.9</Text>
             </View>
          </View>
          
          <View style={styles.driverInfo}>
            <View style={styles.nameRow}>
                <Text style={styles.driverName}>{driverName}</Text>
               <View style={styles.verifiedBadge}>
                 <MaterialIcons name="verified" size={16} color="#009849" />
               </View>
            </View>
            <Text style={styles.vehicleText}>{vehicle}</Text>
          </View>

          <TouchableOpacity style={styles.callBtn}>
            <Ionicons name="call" size={22} color="#009849" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* OTP Section */}
        <View style={styles.otpContainer}>
            <View style={styles.otpInfo}>
                <Text style={styles.otpTitle}>Handshake OTP</Text>
                <Text style={styles.otpSubtitle}>Share this with driver to start ride</Text>
            </View>
            <View style={styles.otpRow}>
                {otpDigits.map((digit, i) => (
                    <View key={i} style={styles.otpBox}>
                        <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                ))}
            </View>
        </View>

        {/* Driver Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Driver is on the way</Text>
            <Text style={styles.progressValue}>{etas[step]}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${((labels.length - 1 - step) / (labels.length - 1)) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Arriving in</Text>
            <Text style={styles.statValue}>{etas[step]}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{labels[step]}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Ride Fare</Text>
            <Text style={styles.statValue}>₹45</Text>
          </View>
        </View>
      </View>

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
    paddingHorizontal: 20,
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
  pickupMarkerOuter: {
    position: "absolute",
    bottom: "40%",
    right: "30%",
    alignItems: "center",
  },
  pickupMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  markerLabel: {
    backgroundColor: "#111827",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  markerLabelText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  driverCallout: {
    position: "absolute",
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
    fontSize: 16,
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
    zIndex: -1,
  },
  driverDot: {
    marginTop: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  routeContainer: {
    position: 'absolute',
    bottom: '40%',
    right: '30%',
    zIndex: -2,
  },
  routePath: {
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#009849',
    borderStyle: 'dashed',
    borderTopLeftRadius: 40,
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
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
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: '#009849',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#111827',
  },
  driverInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  vehicleText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FAF2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    marginBottom: 4,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  progressValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#009849",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#009849",
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otpInfo: {
    flex: 1,
  },
  otpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  otpSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  otpBox: {
    width: 40,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpDigit: {
    fontSize: 18,
    fontWeight: '800',
    color: '#009849',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#F3F4F6',
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  zoomText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
});
