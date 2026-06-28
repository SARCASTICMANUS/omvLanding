import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";
import SHADOW from "../../shared/constants/shadow";
import SPACING from "../../shared/constants/spacing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NOMINATIM_SEARCH, USER_AGENT, STORAGE_KEYS } from "../../constants";
import { useSelector } from "react-redux";

const { width } = Dimensions.get("window");

const heroImages = [
  require("../../../assets/vayyBike.png"),
];

function LocationSearch({ label, placeholder, value, onSelect, dropdownLift = 90 }) {
  const [query, setQuery] = useState(value?.name || value?.display_name || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSelection, setHasSelection] = useState(Boolean(value));
  const [dropdownHeight, setDropdownHeight] = useState(0);
  const isPickup = label === "Start Point";

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
        <Ionicons name="search" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          autoCapitalize="none"
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          style={styles.fieldText}
          value={query}
        />
        {query.length > 0 && !hasSelection && (
          <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
            <Ionicons name="close-circle" size={16} color="#D1D5DB" />
          </TouchableOpacity>
        )}
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
                <Ionicons name="location-outline" size={16} color="#9CA3AF" style={{ marginRight: 10 }} />
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
  const [online, setOnline] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [subLine, setSubLine] = useState("");
  const [showName, setShowName] = useState(false);
  const cursorRef = useRef(new Animated.Value(1)).current;

  const canProceed = useMemo(
    () => Boolean(pickup?.lat && pickup?.lon && destination?.lat && destination?.lon),
    [destination, pickup],
  );

  const { user } = useSelector((state) => state.auth);
  const driverName = user?.full_name || user?.name || user?.first_name || "Driver";
  const [recentSearches, setRecentSearches] = useState([]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.driverRecentSearchesBike);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  };

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
  }, []);

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

  // Removed bike animation effect; static hero images will be displayed.

  const handleNext = () => {
    if (!canProceed) return;
    saveRecentSearch(pickup, destination);
    navigation.navigate("DriverRoutes", { pickup, destination });
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
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          <ImageBackground
            imageStyle={styles.heroImage}
            resizeMode="cover"
            source={heroImages[0]}
            style={styles.hero}
          >
            <View style={styles.heroOverlay} />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Start Your</Text>
              <Text style={styles.heroTitleGreen}>Route</Text>
              <Text style={styles.heroSubtitle}>
                Enter your start and end locations{"\n"}
                to find the best route to drive{"\n"}
                and earn on every trip.
              </Text>
            </View>
          </ImageBackground>

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

  /* ─── Hero ─── */
  hero: {
    height: 280,
    backgroundColor: "#F7F8F8",
    position: "relative",
    overflow: "hidden",
  },
  runningBike: {
    position: "absolute",
    bottom: 0,
    top:120,
    width: width * 0.55,
    height: "70%",
    zIndex: 2,
  },
  road: {
    position: "absolute",
    bottom: 6,
    // top:280,
    left: 0,
    right: 0,
    height: 48,
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
  roadCharacters: {
    position: "absolute",
    // top:500,
    bottom: 38,
    right: 0,
    // position:"relative",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    // gap: 0,
    zIndex: 3,
  },
  roadCharacter: {
    right:30,
    width: 55,
    height: 160,
    // backgroundColor:"red",
    // borderRightColor:"green",
    resizeMode: "cover",
    // boxSizing: "none",
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
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  namasteIcon: {
    fontSize: 28,
    marginBottom: 2,
  },
  typeCursor: {
    width: 2,
    height: 28,
    backgroundColor: COLORS.primary,
    marginLeft: 2,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
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
  topContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    top:30,
    paddingHorizontal: 20,
    // marginBottom: 10,
    // height: 120,
  },
  textContainer: {
    flex: 1,
    maxWidth: "50%",
  },
  topImage: {
    width: 50,
    height: 50,
    resizeMode: "contain",
  },

  /* ─── Panel ─── */
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
  fieldWrap: { marginBottom: 16, zIndex: 10 },
  fieldHead: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  fieldDot: { width: 10, height: 10, borderRadius: 5 },
  fieldLabel: { fontSize: 13, fontWeight: "800", color: "#111827" },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  fieldText: { flex: 1, fontSize: 13, fontWeight: "500", color: "#111827", minHeight: 40, paddingVertical: 0 },
  dropdown: {
    position: "absolute",
    left: 0, right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 14,
    maxHeight: 190,
    ...SHADOW.sm,
    elevation: 20,
    zIndex: 9999,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  resultTitle: { fontSize: 13, fontWeight: "700", color: "#111827" },
  resultSub: { fontSize: 11, fontWeight: "500", color: "#9CA3AF", marginTop: 2 },
  searching: { fontSize: 11, fontWeight: "500", color: "#9CA3AF", marginTop: 6 },

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
