import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LocationSearch from "../../shared/components/common/LocationSearch";
import COLORS from "../../shared/constants/colors";
import SHADOW from "../../shared/constants/shadow";
import { getRecentSearches, saveRecentSearch } from "../../shared/services/searchHistoryService";
import { useSelector } from "react-redux";

const { width } = Dimensions.get("window");

const heroImages = [
  require("../../../assets-webp/vayyAuto.webp"),
];

export default function DriverAutoHomeScreen({ navigation }) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const { user } = useSelector((state) => state.auth);
  const driverName = user?.full_name || user?.name || user?.first_name || "Driver";
  const [imgIndex, setImgIndex] = useState(0);
  const [greeting, setGreeting] = useState("");
  const [subLine, setSubLine] = useState("");
  const [showName, setShowName] = useState(false);
  const cursorRef = useRef(new Animated.Value(1)).current;
  const bikeX = useRef(new Animated.Value(0)).current;
  const bikeOpacity = useRef(new Animated.Value(1)).current;
  const [recentSearches, setRecentSearches] = useState([]);

  const loadRecentSearches = async () => {
    try {
      const data = await getRecentSearches();
      setRecentSearches(Array.isArray(data) ? data : []);
    } catch {}
  };

  const persistRecentSearch = async (pick, dest) => {
    try {
      await saveRecentSearch({
        pickup_name: pick?.name || pick?.display_name || "",
        pickup_lat: pick?.lat || 0,
        pickup_lon: pick?.lon || 0,
        destination_name: dest?.name || dest?.display_name || "",
        destination_lat: dest?.lat || 0,
        destination_lon: dest?.lon || 0,
      });
      loadRecentSearches();
    } catch {}
  };

  const applyRecent = (item) => {
    if (item.pickup && item.destination) {
      setPickup(item.pickup);
      setDestination(item.destination);
    }
  };

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const canProceed = useMemo(
    () => Boolean(pickup?.lat && pickup?.lon && destination?.lat && destination?.lon),
    [destination, pickup],
  );

  useEffect(() => {
    const fullGreeting = "Namaste,";
    const fullSub = "Aaj aap kahan jaana chahte hain?";
    let t = 0;
    let s = 0;
    let phase = "greeting";

    const cursorAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorRef, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(cursorRef, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    cursorAnim.start();

    const tick = () => {
      if (phase === "greeting") {
        if (t < fullGreeting.length) {
          setGreeting(fullGreeting.slice(0, t + 1));
          t++;
          setTimeout(tick, 60);
        } else {
          phase = "namaste_pause";
          setTimeout(tick, 400);
        }
      } else if (phase === "namaste_pause") {
        setShowName(true);
        phase = "sub_pause";
        setTimeout(tick, 500);
      } else if (phase === "sub_pause") {
        phase = "sub";
        setTimeout(tick, 30);
      } else if (phase === "sub") {
        if (s < fullSub.length) {
          setSubLine(fullSub.slice(0, s + 1));
          s++;
          setTimeout(tick, 40);
        } else {
          cursorAnim.stop();
          cursorRef.setValue(0);
        }
      }
    };
    tick();

    return () => {
      cursorAnim.stop();
    };
  }, []);

  useEffect(() => {
    const runCycle = () => {
      bikeX.setValue(0);
      bikeOpacity.setValue(1);
      Animated.timing(bikeX, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        Animated.timing(bikeOpacity, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }).start(() => {
          bikeX.setValue(0);
          setImgIndex((prev) => (prev + 1) % heroImages.length);
          Animated.timing(bikeOpacity, {
            toValue: 1,
            duration: 60,
            useNativeDriver: true,
          }).start();
          runCycle();
        });
      });
    };
    runCycle();

    return () => {
      bikeX.stopAnimation();
      bikeOpacity.stopAnimation();
    };
  }, []);

  const handleNext = () => {
    if (!canProceed) return;
    persistRecentSearch(pickup, destination);
    navigation.navigate("DriverRouteSearch", { pickup, destination, mode: "auto" });
  };

  const handleSwap = () => {
    setPickup(destination);
    setDestination(pickup);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar backgroundColor="#fff" style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView bounces={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ─── Hero ─── */}
          <View style={styles.hero}>
            <Animated.Image
              source={heroImages[imgIndex]}
              style={[
                styles.runningAuto,
                { opacity: bikeOpacity },
                {
                  transform: [
                    {
                      translateX: bikeX.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-width * 0.35, width + 80],
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="contain"
            />
            <View style={styles.heroOverlay} />
            <View style={styles.road}>
              {Array.from({ length: 14 }).map((_, i) => (
                <View key={i} style={[styles.roadDash, { left: i * (width / 14) + 8 }]} />
              ))}
            </View>
            <View style={styles.heroText}>
              <View style={styles.greetingRow}>
                <Text style={styles.namasteIcon}>🙏</Text>
              </View>
              <View style={styles.greetingRow}>
                <Text style={styles.heroTitle}>{greeting}</Text>
                {greeting.length < 8 && <Animated.View style={[styles.typeCursor, { opacity: cursorRef }]} />}
              </View>
              {showName && <Text style={styles.heroAccent}>{driverName}</Text>}
              <View style={styles.subRow}>
                {subLine ? <Text style={styles.heroSub}>{subLine}</Text> : null}
                {subLine.length > 0 && subLine.length < 32 && <Animated.View style={[styles.typeCursor, { height: 20 }, { opacity: cursorRef }]} />}
              </View>
            </View>
          </View>

          {/* ─── Search Panel ─── */}
          <View style={styles.panel}>
            <LocationSearch
              key={`p-${pickup?.display_name || pickup?.name || "e"}`}
              label="Start Point"
              onSelect={setPickup}
              placeholder="Search starting location"
              value={pickup}
            />

            <TouchableOpacity style={styles.swapBtn} onPress={handleSwap} activeOpacity={0.8}>
              <Ionicons name="swap-vertical" size={18} color="#374151" />
            </TouchableOpacity>

            <LocationSearch
              key={`d-${destination?.display_name || destination?.name || "e"}`}
              dropdownLift={90}
              label="Destination"
              onSelect={setDestination}
              placeholder="Enter your destination"
              value={destination}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, !canProceed && styles.primaryBtnDisabled]}
              activeOpacity={0.85}
              disabled={!canProceed}
              onPress={handleNext}
            >
              <Ionicons name="map-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Find Best Route</Text>
            </TouchableOpacity>

            {recentSearches.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.recentHeading}>RECENT SEARCHES</Text>
                {recentSearches.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.82}
                    onPress={() => applyRecent(item)}
                    style={styles.recentRow}
                  >
                    <View style={styles.clockCircle}>
                      <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                    </View>
                    <View style={styles.recentCopy}>
                      <Text numberOfLines={1} style={styles.recentFrom}>
                        {item.pickup?.name || item.pickup?.display_name || "Unknown"}
                      </Text>
                      <Text numberOfLines={1} style={styles.recentTo}>
                        To: {item.destination?.name || item.destination?.display_name || "Unknown"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  hero: {
    height: 280,
    backgroundColor: "#F7F8F8",
    position: "relative",
    overflow: "hidden",
  },
  runningAuto: {
    position: "absolute",
    bottom: 0,
    top: 115,
    width: width * 0.55,
    height: "70%",
    zIndex: 2,
  },
  road: {
    position: "absolute",
    bottom: 2,
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: "#2D2D2D",
    zIndex: 1,
  },
  roadDash: {
    position: "absolute",
    top: "50%",
    width: 20,
    height: 2.5,
    backgroundColor: "#FCD34D",
    marginTop: -1.25,
    borderRadius: 1,
  },
  heroOverlay: {
    position: "absolute",
    top: 0, left: 0, bottom: 0,
    width: "58%",
    backgroundColor: "rgba(247,248,248,0.72)",
  },
  heroText: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 4,
    maxWidth: "75%",
  },
  heroTag: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#03111F",
    lineHeight: 34,
  },
  heroAccent: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.primary,
    lineHeight: 34,
  },
  heroSub: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4B5563",
    lineHeight: 26,
    marginTop: 16,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  namasteIcon: {
    fontSize: 28,
    marginBottom: 2,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  typeCursor: {
    width: 2,
    height: 28,
    backgroundColor: COLORS.primary,
    marginLeft: 2,
  },
  dotRow: {
    position: "absolute",
    bottom: 16,
    left: 20,
    flexDirection: "row",
    gap: 6,
    zIndex: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    width: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },

  panel: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    marginTop: -20,
    zIndex: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },

  swapBtn: {
    alignSelf: "center",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: -6,
    ...SHADOW.sm,
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnDisabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },

  /* recent searches */
  recentSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  recentHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  clockCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  recentCopy: {
    flex: 1,
  },
  recentFrom: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  recentTo: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 1,
  },
});
