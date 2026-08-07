import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import VayyMap from "../../shared/components/VayyMap";
import COLORS from "../../shared/constants/colors";
import SHADOW from "../../shared/constants/shadow";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NOMINATIM_SEARCH, USER_AGENT, STORAGE_KEYS } from "../../constants";
import { useSelector } from "react-redux";

function LocationSearch({ label, placeholder, value, onSelect, dropdownLift = 110 }) {
  const [query, setQuery] = useState(value?.name || value?.display_name || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSelection, setHasSelection] = useState(Boolean(value));
  const [dropdownHeight, setDropdownHeight] = useState(0);
  const isPickup = label === "Start Point";
  const inputRef = useRef(null);

  useEffect(() => {
    if (hasSelection) return;
    if (!query || query.length < 3) {
      setResults([]);
      setDropdownHeight(0);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = NOMINATIM_SEARCH(query);
        const response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: controller.signal,
        });
        const data = await response.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
        setDropdownHeight(0);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [hasSelection, query]);

  const handleSelect = (item) => {
    const next = {
      lat: Number(item.lat), lon: Number(item.lon),
      name: item.name || item.display_name?.split(",")?.[0],
      display_name: item.display_name,
    };
    setQuery(next.display_name || next.name || "");
    setResults([]);
    setDropdownHeight(0);
    setLoading(false);
    setHasSelection(true);
    onSelect(next);
  };

  const handleChangeText = (text) => {
    setQuery(text);
    setHasSelection(false);
    if (text.length < 3) { setResults([]); setDropdownHeight(0); }
  };

  const showResults = results.length > 0;

  return (
    <View style={[styles.fieldWrap, showResults && { marginBottom: dropdownHeight + 20, zIndex: 9999 }]}>
      <View style={styles.fieldHead}>
        <View style={[styles.fieldDot, { backgroundColor: isPickup ? COLORS.primary : "#EF4444" }]} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <View style={styles.fieldInput}>
        <View style={[styles.fieldIconBox, { backgroundColor: isPickup ? "rgba(0,152,73,0.1)" : "rgba(239,68,68,0.1)" }]}>
          <Ionicons name={isPickup ? "locate-outline" : "navigate-outline"} size={16} color={isPickup ? COLORS.primary : "#EF4444"} />
        </View>
        <TextInput
          ref={inputRef}
          autoCapitalize="none"
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          style={styles.fieldText}
          value={query}
        />
        {query.length > 0 && !hasSelection && (
          <TouchableOpacity onPress={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}>
            <Ionicons name="close-circle" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        )}
        {hasSelection && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
      </View>
      {showResults ? (
        <View onLayout={(e) => setDropdownHeight(e.nativeEvent.layout.height)} style={[styles.dropdown, { top: dropdownLift }]}>
          <FlatList
            data={results}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => String(item.place_id)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleSelect(item)} style={styles.resultRow}>
                <View style={styles.resultIconBox}>
                  <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.resultTitle}>
                    {item.name || item.display_name?.split(",")?.[0]}
                  </Text>
                  <Text numberOfLines={2} style={styles.resultSub}>{item.display_name}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : loading ? <Text style={styles.searching}>Searching...</Text> : null}
    </View>
  );
}

export default function DriverBikeHomeScreen({ navigation }) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [subLine, setSubLine] = useState("");
  const [showName, setShowName] = useState(false);
  const cursorRef = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  const canProceed = useMemo(
    () => Boolean(pickup?.lat && pickup?.lon && destination?.lat && destination?.lon),
    [destination, pickup],
  );

  const { user } = useSelector((state) => state.auth);
  const driverName = user?.full_name || user?.name || user?.first_name || "Driver";
  const [recentSearches, setRecentSearches] = useState([]);

  const loadRecentSearches = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.driverRecentSearchesBike);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  const saveRecentSearch = async (pick, dest) => {
    try {
      const entry = { pickup: pick, destination: dest };
      const updated = [entry, ...recentSearches.filter(
        (r) => r.pickup?.name !== pick?.name || r.destination?.name !== dest?.name,
      )].slice(0, 5);
      setRecentSearches(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.driverRecentSearchesBike, JSON.stringify(updated));
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
      Animated.timing(keyboardHeight, { toValue: e.endCoordinates.height, duration: 250, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      Animated.timing(keyboardHeight, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [cardAnim, keyboardHeight, loadRecentSearches]);

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
    return () => { cursorAnim.stop(); };
  }, [cursorRef]);

  const handleNext = () => {
    if (!canProceed) return;
    saveRecentSearch(pickup, destination);
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
        style={StyleSheet.absoluteFillObject}
        initialViewState={{
          center: [80.9462, 26.8467],
          zoom: 12,
        }}
      />

      {/* Greeting — dark overlay */}
      <View style={styles.greetingGradient} pointerEvents="none">
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
      </View>

      {/* Floating bottom card */}
      <Animated.View style={[styles.cardKeyboard, { bottom: keyboardHeight }]}>
        <Animated.View style={[styles.cardWrap, { transform: [{ translateY: cardTranslateY }] }]}>
          <View style={styles.cardBg}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.cardScroll}
            >
              <LocationSearch
                key={`p-${pickup?.display_name || pickup?.name || "e"}`}
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
                key={`d-${destination?.display_name || destination?.name || "e"}`}
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
                    <Text style={styles.recentHeading}>RECENT</Text>
                  </View>
                  {recentSearches.slice(0, 3).map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.82}
                      onPress={() => applyRecent(item)}
                      style={styles.recentRow}
                    >
                      <View style={styles.routeMini}>
                        <View style={[styles.routeMiniDot, { backgroundColor: COLORS.primary }]} />
                        <View style={styles.routeMiniLine} />
                        <View style={[styles.routeMiniDot, { backgroundColor: "#EF4444" }]} />
                      </View>
                      <View style={styles.recentCopy}>
                        <Text numberOfLines={1} style={styles.recentFrom}>
                          {item.pickup?.name || item.pickup?.display_name || "Unknown"}
                        </Text>
                        <Text numberOfLines={1} style={styles.recentTo}>
                          {item.destination?.name || item.destination?.display_name || "Unknown"}
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

  /* Greeting */
  greetingGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 10,
    paddingTop: 30,
    paddingHorizontal: 20,
    backgroundColor: "rgba(10, 22, 60, 0.94)",
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
    color: "#fff",
    marginLeft: 6,
  },
  nameText: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.primary,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    ...SHADOW.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  cardBg: {
    backgroundColor: "#ffffffff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardScroll: { flexGrow: 1 },

  /* Fields */
  fieldWrap: { marginBottom: 14, zIndex: 10 },
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
  dropdown: {
    position: "absolute",
    left: 0, right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 14,
    maxHeight: 180,
    ...SHADOW.sm,
    elevation: 20,
    zIndex: 9999,
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
    ...SHADOW.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
  routeMini: {
    width: 18,
    alignItems: "center",
  },
  routeMiniDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  routeMiniLine: {
    width: 2,
    flex: 1,
    minHeight: 16,
    backgroundColor: "rgba(0,0,0,0.12)",
    marginVertical: 2,
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
