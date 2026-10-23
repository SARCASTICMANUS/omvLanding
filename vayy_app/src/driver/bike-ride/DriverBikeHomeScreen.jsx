import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { DEFAULT_CENTER } from "../../constants/mapConfig";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import VayyMap, { Marker } from "../../shared/components/VayyMap";
import LocationSearch from "../../shared/components/common/LocationSearch";
import COLORS from "../../shared/constants/colors";
import SHADOW from "../../shared/constants/shadow";
import { getRecentSearches, saveRecentSearch } from "../../shared/services/searchHistoryService";
import { useSelector } from "react-redux";

const SHEET_COMPACT = 240;
const BIKE_TOP_IMAGE = require("../../../assets/vayyTopBike1.webp");

export default function DriverBikeHomeScreen({ navigation }) {
  const { height: windowHeight } = useWindowDimensions();
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [subLine, setSubLine] = useState("");
  const [showName, setShowName] = useState(false);
  const cursorRef = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);
  const [currentPos, setCurrentPos] = useState(null);

  const locateUser = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      setCurrentPos({ latitude, longitude });
      mapRef.current?.setCamera({
        center: [longitude, latitude],
        zoom: 15,
        duration: 800,
      });
    } catch {}
  }, []);

  useEffect(() => {
    locateUser();
  }, [locateUser]);

  const sheetHeight = useRef(new Animated.Value(SHEET_COMPACT)).current;
  const sheetStartRef = useRef(SHEET_COMPACT);
  const kbLiftRef = useRef(0);
  const preKbHeightRef = useRef(SHEET_COMPACT);
  const kbClampRef = useRef(SHEET_COMPACT);

  const getSheetMax = () =>
    Math.max(
      SHEET_COMPACT,
      Math.round(Dimensions.get("window").height) - 80 - kbLiftRef.current,
    );

  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        sheetStartRef.current = sheetHeight.__getValue();
      },
      onPanResponderMove: (_, g) => {
        const next = Math.min(
          getSheetMax(),
          Math.max(SHEET_COMPACT, sheetStartRef.current - g.dy),
        );
        sheetHeight.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const max = getSheetMax();
        const next = sheetStartRef.current - g.dy;
        const target = next >= (SHEET_COMPACT + max) / 2 ? max : SHEET_COMPACT;
        Animated.spring(sheetHeight, {
          toValue: target,
          friction: 9,
          tension: 80,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetHeight, { toValue: SHEET_COMPACT, friction: 9, useNativeDriver: false }).start();
      },
    }),
  ).current;

  const canProceed = useMemo(() => {
    const hasCoordinates = (point) =>
      point?.lat != null && point?.lon != null &&
      Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon));
    return hasCoordinates(pickup) && hasCoordinates(destination);
  }, [destination, pickup]);

  const { user } = useSelector((state) => state.auth);
  const driverName = user?.full_name || user?.name || user?.first_name || "Driver";
  const [recentSearches, setRecentSearches] = useState([]);

  const loadRecentSearches = useCallback(async () => {
    try {
      const data = await getRecentSearches();
      setRecentSearches(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

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
    Animated.spring(cardAnim, {
      toValue: 1,
      tension: 50,
      friction: 14,
      useNativeDriver: true,
    }).start();

    const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      const kbHeight = e.endCoordinates.height;
      const lift = Platform.OS === "ios" ? kbHeight : 0;
      kbLiftRef.current = lift;
      Animated.timing(keyboardHeight, { toValue: lift, duration: 250, useNativeDriver: false }).start();

      const current = sheetHeight.__getValue();
      preKbHeightRef.current = current;
      const spaceAbove = Math.max(SHEET_COMPACT, windowHeight - kbHeight - 16);
      const target = Math.max(SHEET_COMPACT, Math.min(current, spaceAbove));
      kbClampRef.current = target;
      Animated.spring(sheetHeight, { toValue: target, friction: 9, tension: 80, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      kbLiftRef.current = 0;
      Animated.timing(keyboardHeight, { toValue: 0, duration: 250, useNativeDriver: false }).start();
      const current = sheetHeight.__getValue();
      const target = Math.abs(current - kbClampRef.current) < 2 ? preKbHeightRef.current : current;
      Animated.spring(sheetHeight, { toValue: target, friction: 9, useNativeDriver: false }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [cardAnim, keyboardHeight, loadRecentSearches]);

  useEffect(() => {
    const fullGreeting = "Namaste,";
    const fullSub = "Aaj aap kahan jaana chahte hain?";
    let alive = true;
    const timers = [];
    const later = (fn, ms) => {
      if (!alive) return;
      timers.push(setTimeout(fn, ms));
    };

    const cursorAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorRef, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(cursorRef, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    cursorAnim.start();

    let t = 0;
    let s = 0;
    let phase = "greeting";

    const tick = () => {
      if (!alive) return;
      if (phase === "greeting") {
        if (t < fullGreeting.length) {
          setGreeting(fullGreeting.slice(0, t + 1));
          t++;
          later(tick, 70);
        } else {
          phase = "namaste_pause";
          later(tick, 400);
        }
      } else if (phase === "namaste_pause") {
        setShowName(true);
        phase = "sub_pause";
        later(tick, 500);
      } else if (phase === "sub_pause") {
        phase = "sub";
        later(tick, 30);
      } else if (phase === "sub") {
        if (s < fullSub.length) {
          setSubLine(fullSub.slice(0, s + 1));
          s++;
          later(tick, 40);
        } else {
          cursorAnim.stop();
          cursorRef.setValue(0);
        }
      }
    };
    tick();

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      cursorAnim.stop();
    };
  }, [cursorRef]);

  const handleNext = () => {
    if (!canProceed) return;
    persistRecentSearch(pickup, destination);
    navigation.navigate("DriverRouteSearch", { pickup, destination, mode: "bike" });
  };

  const handleSwap = () => {
    setPickup(destination);
    setDestination(pickup);
  };

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" style="light" />

      {/* Map background */}
      <VayyMap
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        grayscale
        initialViewState={{
          center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
          zoom: 12,
        }}
      >
        {currentPos && (
          <Marker lngLat={[currentPos.longitude, currentPos.latitude]} anchor="center">
            <View style={styles.riderMarker}>
              <Image
                source={BIKE_TOP_IMAGE}
                style={{ width: 46, height: 46 }}
                resizeMode="contain"
              />
            </View>
          </Marker>
        )}
      </VayyMap>

      {/* Locate button — floats above the search card */}
      <Animated.View
        style={[styles.locateWrap, { bottom: Animated.add(Animated.add(sheetHeight, keyboardHeight), 16), pointerEvents: "box-none" }]}
      >
        <TouchableOpacity style={styles.locateBtn} onPress={locateUser} activeOpacity={0.85}>
          <Ionicons name="locate" size={20} color="#111827" />
        </TouchableOpacity>
      </Animated.View>

      {/* Greeting — blue gradient overlay */}
      <LinearGradient
        colors={["rgba(10, 22, 60, 0.94)", "rgba(10, 22, 62, 0.0010)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.greetingGradient, { pointerEvents: "none" }]}
      >
        <View style={styles.greetingContent}>
          <View style={styles.greetingRow}>
            <Text style={styles.namasteIcon}>🙏</Text>
            <Text style={styles.greetingText}>{greeting}</Text>
            {greeting.length < 8 && <Animated.View style={[styles.typeCursor, { opacity: cursorRef }]} />}
          </View>
          {showName && <Text style={styles.nameText}>{driverName}</Text>}
          <View style={styles.subRow}>
            {subLine ? <Text style={styles.subText}>{subLine}</Text> : null}
            {subLine.length > 0 && subLine.length < 32 && (
              <Animated.View style={[styles.typeCursor, { height: 16 }, { opacity: cursorRef }]} />
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Floating bottom card */}
      <Animated.View style={[styles.cardKeyboard, { height: sheetHeight, bottom: keyboardHeight }]}>
        <Animated.View style={[styles.cardWrap, { transform: [{ translateY: cardTranslateY }] }]}>
          <View style={styles.cardBg}>
            <View style={styles.dragHandleWrap} {...sheetPan.panHandlers}>
              <View style={styles.sheetHandle} />
              <Text style={styles.dragHint}>Drag up for recent searches</Text>
            </View>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.sheetScroll}
              contentContainerStyle={styles.cardScroll}
            >
              <LocationSearch
                isPickup
                label="Start Point"
                onSelect={setPickup}
                placeholder="Search starting location"
                value={pickup}
              />

              <View style={styles.swapRow}>
                <View style={styles.swapLine} />
                <TouchableOpacity style={styles.swapBtn} onPress={handleSwap} activeOpacity={0.8}>
                  <Ionicons name="swap-vertical" size={16} color="#fff" />
                </TouchableOpacity>
                <View style={styles.swapLine} />
              </View>

              <LocationSearch
                dropdownLift={110}
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
                <Ionicons name="map-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Find Best Route</Text>
              </TouchableOpacity>

              {recentSearches.length > 0 && (
                <View style={styles.recentSection}>
                  <View style={styles.recentHeader}>
                    <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                    <Text style={styles.recentHeading}>RECENT SEARCHES</Text>
                  </View>
                  {recentSearches.slice(0, 3).map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.82}
                      onPress={() => applyRecent(item)}
                      style={styles.recentRow}
                    >
                      <View style={styles.recentIconCircle}>
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
            </ScrollView>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* rider marker */
  riderMarker: {
    alignItems: "center",
    justifyContent: "center",
  },

  /* locate button — wrapper keeps it floating above the search card */
  locateWrap: {
    position: "absolute",
    right: 16,
    zIndex: 12,
  },
  locateBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2 4 rgba(0, 0, 0, 0.2)",
  },

  /* Greeting */
  greetingGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 240,
    zIndex: 10,
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  greetingContent: {
    top: 40,
    alignSelf: "flex-start",
    maxWidth: "72%",
  },
  greetingRow: {

    flexDirection: "row",
    alignItems: "center",
  },
  namasteIcon: { fontSize: 28, marginBottom: 1 },
  typeCursor: {
    width: 2,
    height: 30,
    backgroundColor: COLORS.primary,
    marginLeft: 3,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  greetingText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFD700",
    marginLeft: 6,
  },
  nameText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 2,
  },
  subText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    marginTop: 6,
  },

  /* Card */
  cardKeyboard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  cardWrap: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    boxShadow: "0 2 8 rgba(0, 0, 0, 0.06)",
  },
  cardBg: {
    flex: 1,
    backgroundColor: "#ffffffff",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardScroll: { flexGrow: 1, paddingBottom: 20 },

  /* drag handle */
  dragHandleWrap: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 12,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  dragHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 6,
  },
  sheetScroll: { flex: 1 },

  /* Fields */
  fieldWrap: { marginBottom: 14 },
  fieldHead: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 },
  fieldDot: { width: 8, height: 8, borderRadius: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#374151", letterSpacing: 0.3 },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 4,
    paddingLeft: 4,
  },
  fieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  fieldText: { flex: 1, fontSize: 14, fontWeight: "500", color: "#111827", minHeight: 36, paddingVertical: 0 },
  dropdownInline: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 14,
    maxHeight: 180,
    marginTop: 6,
    boxShadow: "0 1 4 rgba(0, 0, 0, 0.04)",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 10,
  },
  resultIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(0,152,73,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: { fontSize: 13, fontWeight: "700", color: "#111827" },
  resultSub: { fontSize: 11, fontWeight: "500", color: "#9CA3AF", marginTop: 1 },
  searching: { fontSize: 11, fontWeight: "500", color: "#9CA3AF", marginTop: 6, paddingLeft: 4 },

  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  swapBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    marginTop: 4,
    boxShadow: "0 1 4 rgba(0, 0, 0, 0.04)",
  },
  primaryBtnDisabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  /* recent */
  recentSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(159, 16, 16, 0.05)",
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  recentHeading: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.6,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  recentIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  recentCopy: { flex: 1 },
  recentFrom: {
    fontSize: 12,
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
