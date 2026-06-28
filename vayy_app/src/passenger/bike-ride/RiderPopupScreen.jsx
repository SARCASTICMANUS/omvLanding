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
import VayyMap from "../../shared/components/VayyMap";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";

import { ConfirmPopup } from "./ConfirmPopup";

const { width } = Dimensions.get("window");

export function RiderPopupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const driverName = route?.params?.driverName || "Priya Sharma";
  const vehicle = route?.params?.vehicle || "Royal Enfield Classic • UP 32 AZ 1234";
  const otpDigits = route?.params?.otp ? String(route.params.otp).split("") : ["2","7","4","1"];
  const labels = route?.params?.distanceLabels || ["1.2 km", "800 m", "400 m", "Arrived"];
  const etas = route?.params?.etaLabels || ["5 min", "3 min", "2 min", "0 min"];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((v) => {
        if (v === labels.length - 1) {
          clearInterval(timer);
          setTimeout(() => {
            const tripData = route?.params?.tripData || {};
            navigation.navigate('RideStats', {
              driverName,
              vehicle,
              dispatchId: route?.params?.dispatchId,
              destination: route?.params?.destination,
              eta: route?.params?.eta || "3",
              distance: route?.params?.distance || "800",
              fare: route?.params?.fare,
              tripData,
            });
          }, 2000);
          return v;
        }
        return v + 1;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [navigation]);

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
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Ride Accepted!</Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCancelConfirm(true)}>
            <Text style={styles.cancelText}>Cancel</Text>
            <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* User Location Marker */}
        <View style={styles.userMarkerOuter}>
          <View style={styles.userMarker}>
             <View style={styles.userDot} />
          </View>
          <View style={styles.markerLabel}>
            <Text style={styles.markerLabelText}>You</Text>
          </View>
        </View>

        {/* Driver Tracking Callout */}
        <View style={[styles.driverCallout, { bottom: 250 - step * 40, left: 100 + step * 30 }]}>
          <View style={styles.calloutBox}>
            <Text style={styles.calloutValue}>{labels[step]}</Text>
            <Text style={styles.calloutLabel}>{step === labels.length - 1 ? 'at pickup' : 'away'}</Text>
          </View>
          <View style={styles.calloutArrow} />
          <View style={styles.driverIconCircle}>
            <Text style={{ fontSize: 20 }}>🏍️</Text>
          </View>
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

        {/* Status Notification */}
        <View style={styles.acceptedBanner}>
           <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={20} color="#009849" />
           </View>
           <View style={styles.acceptedInfo}>
              <Text style={styles.acceptedTitle}>Ride Accepted!</Text>
              <Text style={styles.acceptedSubtitle}>Your driver is on the way to you</Text>
           </View>
           <Text style={styles.timestamp}>Just now</Text>
        </View>

        <View style={styles.divider} />

        {/* Driver Row */}
        <View style={styles.driverRow}>
          <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{driverName.charAt(0)}</Text>
             <View style={styles.badge}>
                <Ionicons name="star" size={10} color="#FFB800" />
                <Text style={styles.ratingText}>4.9</Text>
             </View>
          </View>
          <View style={styles.driverDetails}>
             <View style={styles.nameRow}>
                 <Text style={styles.driverName}>{driverName}</Text>
                <MaterialIcons name="verified" size={16} color="#009849" />
             </View>
              <Text style={styles.vehicleInfo}>{vehicle}</Text>
          </View>
          <TouchableOpacity style={styles.callBtn}>
             <Ionicons name="call" size={22} color="#009849" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* OTP Section */}
        <View style={styles.otpContainer}>
           <View>
              <Text style={styles.otpLabel}>Handshake OTP</Text>
              <Text style={styles.otpSub}>Share with driver to start ride</Text>
           </View>
           <View style={styles.otpRow}>
               {otpDigits.map((d, i) => (
                  <View key={i} style={styles.otpBox}>
                    <Text style={styles.otpDigit}>{d}</Text>
                 </View>
              ))}
           </View>
        </View>

        <View style={styles.arrivalNote}>
            <Text style={styles.arrivalNoteText}>
                {step === labels.length - 1 
                  ? "Driver has arrived. Verifying OTP..." 
                  : `Driver is ${labels[step]} away • Arriving in ${etas[step]}`}
            </Text>
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
  userMarkerOuter: {
    position: 'absolute',
    bottom: '45%',
    right: '25%',
    alignItems: 'center',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerLabel: {
     backgroundColor: '#111827',
     paddingHorizontal: 6,
     paddingVertical: 2,
     borderRadius: 4,
     marginTop: 4,
  },
  markerLabelText: {
     color: '#FFFFFF',
     fontSize: 9,
     fontWeight: '800',
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
  driverIconCircle: {
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
    paddingBottom: 40,
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
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FAF2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptedInfo: {
    flex: 1,
  },
  acceptedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  acceptedSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 18,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: '#009849',
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
  },
  driverDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  vehicleInfo: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FAF2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  otpSub: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  otpBox: {
    width: 38,
    height: 42,
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
  arrivalNote: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  arrivalNoteText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '700',
  },
  zoomText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
});
