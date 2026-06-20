import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import { ConfirmPopup } from "../bike-ride/ConfirmPopup";
import { NoRideFoundPopup } from "../bike-ride/NoRideFoundPopup";

const { width } = Dimensions.get("window");

export function AutoSearchingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const [showNoRide, setShowNoRide] = useState(false);
  const [showBoardConfirm, setShowBoardConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [searchStatus, setSearchStatus] = useState("searching");
  const timerRef = useRef(null);

  const startSearch = useCallback(() => {
    setShowNoRide(false);
    setSearchStatus("searching");
    timerRef.current = setTimeout(() => {
      setShowNoRide(true);
      setSearchStatus("failed");
    }, 4000);
  }, []);

  function handleTryAgain() {
    setShowNoRide(false);
    setSearchStatus("searching");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearchStatus("found");
      setShowBoardConfirm(true);
    }, 4000);
  }

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.5,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    startSearch();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startSearch, scaleAnim, opacityAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Finding Auto...</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="more-vert" size={24} color="#111827" />
        </TouchableOpacity>
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

        <View style={styles.pulseContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          />
          <View style={styles.userDot}>
            <Ionicons name="person" size={20} color="#FFFFFF" />
          </View>
        </View>

        <TouchableOpacity style={styles.recenterBtn}>
          <MaterialIcons name="my-location" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.handle} />

        <View style={styles.availabilityRow}>
          <View style={styles.availItem}>
            <Ionicons name="car" size={18} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>3</Text> autos nearby</Text>
          </View>
          <View style={styles.availDivider} />
          <View style={styles.availItem}>
            <Ionicons name="time-outline" size={18} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>~4 min</Text> avg. wait</Text>
          </View>
        </View>

        <View style={styles.searchingInfo}>
          <Text style={styles.searchingTitle}>
            {searchStatus === "found" ? "Auto Found!" : "Searching for nearby autos..."}
          </Text>
          <Text style={styles.searchingSub}>
            {searchStatus === "found"
              ? "Auto driver has been notified"
              : "Your location has been shared with nearby auto drivers"}
          </Text>
        </View>

        {searchStatus === "found" ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.foundBtn}
            onPress={() => setShowBoardConfirm(true)}
          >
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            <Text style={styles.foundBtnText}>  Auto Found! Tap to board</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={1} style={styles.raisedBtn} disabled>
            <Text style={styles.raisedText}>✋  Hand Raised</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => setShowCancelConfirm(true)} style={styles.cancelLink}>
          <Text style={styles.cancelLinkText}>Cancel Request</Text>
        </TouchableOpacity>
      </View>

      <NoRideFoundPopup
        visible={showNoRide}
        onTryAgain={handleTryAgain}
        onCancel={() => navigation.goBack()}
      />

      <ConfirmPopup
        visible={showBoardConfirm}
        title="Boarded the Auto?"
        message="Confirm if you've boarded the auto at Hazratganj Metro Gate 2. Your ride will start."
        confirmLabel="Yes, I'm on board"
        icon="checkmark-circle-outline"
        onConfirm={() => {
          setShowBoardConfirm(false);
          navigation.navigate('AutoRideComplete');
        }}
        onCancel={() => setShowBoardConfirm(false)}
      />

      <ConfirmPopup
        visible={showCancelConfirm}
        title="Cancel Request?"
        message="Your hand raise request will be cancelled."
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
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
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
  mapArea: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
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
  pulseContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "#009849",
    backgroundColor: "rgba(0, 152, 73, 0.1)",
  },
  userDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 4,
    borderColor: "#FFFFFF",
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
    marginBottom: 24,
  },
  availabilityRow: {
    flexDirection: "row",
    backgroundColor: "#ECFAF1",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    justifyContent: "center",
    gap: 16,
  },
  availItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  availText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  availBold: {
    fontWeight: "800",
    color: "#009849",
  },
  availDivider: {
    width: 1,
    backgroundColor: "#A7F3C4",
  },
  searchingInfo: {
    alignItems: "center",
    marginBottom: 24,
  },
  searchingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  searchingSub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
  raisedBtn: {
    height: 60,
    borderRadius: 20,
    backgroundColor: "rgba(0, 152, 73, 0.4)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  raisedText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  foundBtn: {
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
  foundBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  cancelLink: {
    marginTop: 16,
    alignItems: "center",
  },
  cancelLinkText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "700",
  },
});
