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
import api from "../../shared/lib/api";

import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SHADOW from "../../shared/constants/shadow";
import SPACING from "../../shared/constants/spacing";

const { width } = Dimensions.get("window");

const heroImage = require("../../../assets/trip.png");

const heroImages = [
  require("../../../assets/vayyBike.png"),
  require("../../../assets/vayyScoty.png"),
  require("../../../assets/vayySportBike.png"),
];

const DUMMY_RECENT = [
  {
    pickup: { name: "Gomti Nagar", lat: 26.8467, lon: 80.9462, display_name: "Gomti Nagar, Lucknow, Uttar Pradesh" },
    destination: { name: "Charbagh", lat: 26.8318, lon: 80.9194, display_name: "Charbagh, Lucknow, Uttar Pradesh" },
  },
  {
    pickup: { name: "Hazratganj", lat: 26.8572, lon: 80.9435, display_name: "Hazratganj, Lucknow, Uttar Pradesh" },
    destination: { name: "Alambagh", lat: 26.7877, lon: 80.8926, display_name: "Alambagh, Lucknow, Uttar Pradesh" },
  },
  {
    pickup: { name: "Indira Nagar", lat: 26.8965, lon: 80.9758, display_name: "Indira Nagar, Lucknow, Uttar Pradesh" },
    destination: { name: "Lalbagh", lat: 26.8621, lon: 80.8946, display_name: "Lalbagh, Lucknow, Uttar Pradesh" },
  },
];

function LocationSearch({ label, placeholder, value, onSelect, dropdownLift = 90 }) {
  const [query, setQuery] = useState(value?.name || value?.display_name || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSelection, setHasSelection] = useState(Boolean(value));
  const [dropdownHeight, setDropdownHeight] = useState(0);

  useEffect(() => {
    if (hasSelection) {
      return undefined;
    }

    if (!query || query.length < 3) {
      setResults([]);
      setDropdownHeight(0);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query,
        )}&format=json&limit=5`;
        const response = await fetch(url, {
          headers: { "User-Agent": "vayy-autos/1.0" },
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

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [hasSelection, query]);

  const handleSelect = (item) => {
    const next = {
      lat: Number(item.lat),
      lon: Number(item.lon),
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

    if (text.length < 3) {
      setResults([]);
      setDropdownHeight(0);
    }
  };

  const showResults = results.length > 0;

  return (
    <View
      style={[
        styles.locationField,
        showResults && { marginBottom: dropdownHeight + 20, zIndex: 9999 },
      ]}
    >
      <View style={styles.labelRow}>
        <View style={styles.pinIcon} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>

      <View style={styles.searchInputWrap}>
        <Text style={styles.searchIcon}>o</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9AA8BE"
          style={styles.searchInput}
          value={query}
        />
        <Text style={styles.locationIcon}>+</Text>
      </View>

      {showResults ? (
        <View
          onLayout={(e) => setDropdownHeight(e.nativeEvent.layout.height)}
          style={[styles.dropdown, { top: dropdownLift }]}
        >
          <FlatList
            data={results}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => String(item.place_id)}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleSelect(item)} style={styles.resultRow}>
                <Text numberOfLines={1} style={styles.resultTitle}>
                  {item.name || item.display_name?.split(",")?.[0]}
                </Text>
                <Text numberOfLines={2} style={styles.resultSubtitle}>
                  {item.display_name}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : loading ? (
        <Text style={styles.searchingText}>Searching...</Text>
      ) : null}
    </View>
  );
}

function RecentRow({ item, onPress }) {
  const fromName = item.pickup?.name || item.pickup?.display_name || "Unknown Start";
  const toName = item.destination?.name || item.destination?.display_name || "Unknown End";

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.recentRow}>
      <View style={styles.clockCircle}>
        <Text style={styles.clockText}>C</Text>
      </View>
      <View style={styles.recentCopy}>
        <Text numberOfLines={1} style={styles.recentFrom}>
          {fromName}
        </Text>
        <Text numberOfLines={1} style={styles.recentTo}>
          To: {toName}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function PassengerTripPlanner({ navigation, route }) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [fetchingRecent, setFetchingRecent] = useState(false);
  const loading = route?.params?.loading || false;
  const mode = route?.params?.mode || "auto";
  const isBike = mode === "bike";
  const [imgIndex, setImgIndex] = useState(0);
  const [greeting, setGreeting] = useState("");
  const [subLine, setSubLine] = useState("");
  const [showName, setShowName] = useState(false);
  const cursorRef = useRef(new Animated.Value(1)).current;
  const bikeX = useRef(new Animated.Value(0)).current;
  const bikeOpacity = useRef(new Animated.Value(1)).current;
  const passengerName = "Arjun";

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

  const fetchRecentSearches = async () => {
    try {
      setFetchingRecent(true);
      const response = await api.get("/api/passenger/recent-searches/");
      setRecentSearches(Array.isArray(response.data) ? response.data : DUMMY_RECENT);
    } catch (error) {
      console.error("Failed to fetch recent searches:", error);
      setRecentSearches(DUMMY_RECENT);
    } finally {
      setFetchingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecentSearches();
  }, []);

  const canProceed = useMemo(() => {
    return Boolean(
      pickup?.lat && pickup?.lon && destination?.lat && destination?.lon,
    );
  }, [destination, pickup]);

  const handleNext = () => {
    if (!canProceed || loading) {
      return;
    }

    const pickupName = pickup?.name || pickup?.display_name?.split(",")?.[0] || "Current Location";
    const destName = destination?.name || destination?.display_name?.split(",")?.[0] || "Destination";

    const dummyTrips = [
      {
        id: 1, trip_id: "dummy-1",
        eta_seconds: 300, pickup_name: pickupName, destination_name: destName,
        rating: 4.8, review_count: 234, fuel_type: "CNG", walk_minutes: 2,
        fare: 78, payment_method: "Cash", distance_text: "4.5 km", duration_text: "15 min", distance_km: 4.5,
        stops: [
          { name: pickupName, status: "boarding" },
          { name: "Hazratganj", status: "upcoming" },
          { name: "Civil Lines", status: "upcoming" },
          { name: destName, status: "dropoff" },
        ],
      },
      {
        id: 2, trip_id: "dummy-2",
        eta_seconds: 420, pickup_name: pickupName, destination_name: destName,
        rating: 4.6, review_count: 187, fuel_type: "CNG", walk_minutes: 4,
        fare: 65, payment_method: "UPI", distance_text: "5.2 km", duration_text: "20 min", distance_km: 5.2,
        stops: [
          { name: pickupName, status: "boarding" },
          { name: "Sahkar Nagar", status: "upcoming" },
          { name: "Lalbagh", status: "upcoming" },
          { name: "Aminabad", status: "upcoming" },
          { name: destName, status: "dropoff" },
        ],
      },
      {
        id: 3, trip_id: "dummy-3",
        eta_seconds: 540, pickup_name: pickupName, destination_name: destName,
        rating: 4.9, review_count: 312, fuel_type: "Electric", walk_minutes: 1,
        fare: 92, payment_method: "Cash", distance_text: "6.0 km", duration_text: "25 min", distance_km: 6.0,
        stops: [
          { name: pickupName, status: "boarding" },
          { name: "River Road", status: "upcoming" },
          { name: "Museum", status: "upcoming" },
          { name: destName, status: "dropoff" },
        ],
        is_route_only: false, trip_available: true,
      },
    ];

    navigation.navigate("PassengerRouteList", { trips: dummyTrips, pickup, destination, mode });
  };

  const handleSwap = () => {
    setPickup(destination);
    setDestination(pickup);
  };

  const applyRecent = (item) => {
    if (item.pickup && item.destination) {
      setPickup(item.pickup);
      setDestination(item.destination);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar backgroundColor="#F7F8F8" style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboard}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {isBike ? (
            <View style={styles.bikeHero}>
              <Animated.Image
                source={heroImages[imgIndex]}
                style={[
                  styles.runningBike,
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
                  <Image source={require("../../../assets/vayyNamaste.png")} style={styles.namasteIcon} />
                </View>
                <View style={styles.greetingRow}>
                  <Text style={styles.heroTitle}>{greeting}</Text>
                  {greeting.length < 8 && <Animated.View style={[styles.typeCursor, { opacity: cursorRef }]} />}
                </View>
                {showName && <Text style={styles.heroAccent}>{passengerName}</Text>}
                <View style={styles.subRow}>
                  {subLine ? <Text style={styles.heroSub}>{subLine}</Text> : null}
                  {subLine.length > 0 && subLine.length < 32 && <Animated.View style={[styles.typeCursor, { height: 20 }, { opacity: cursorRef }]} />}
                </View>
              </View>
            </View>
          ) : (
            <ImageBackground
              imageStyle={styles.heroImage}
              resizeMode="cover"
              source={heroImage}
              style={styles.hero}
            >
              <View style={styles.heroOverlayAuto} />
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Choose Your</Text>
                <Text style={styles.heroTitleGreen}>Route</Text>
                <Text style={styles.heroSubtitle}>
                  Enter your pickup and drop locations{"\n"}
                  to find the best bus routes{"\n"}
                  and track in real-time.
                </Text>
              </View>
            </ImageBackground>
          )}

          <View style={styles.searchPanel}>
            <LocationSearch
              key={`pickup-${pickup?.display_name || pickup?.name || "empty"}`}
              label="Pickup Point"
              onSelect={setPickup}
              placeholder="Search pickup location"
              value={pickup}
            />

            <TouchableOpacity activeOpacity={0.8} onPress={handleSwap} style={styles.swapButton}>
              <Text style={styles.swapText}>S</Text>
            </TouchableOpacity>

            <LocationSearch
              key={`destination-${destination?.display_name || destination?.name || "empty"}`}
              dropdownLift={90}
              label="Drop Location"
              onSelect={setDestination}
              placeholder="Enter your destination"
              value={destination}
            />

            <TouchableOpacity
              activeOpacity={0.86}
              disabled={!canProceed || loading}
              onPress={handleNext}
              style={[
                styles.searchButton,
                isBike && { backgroundColor: COLORS.primary },
                (!canProceed || loading) && styles.searchDisabled,
              ]}
            >
              <Text style={styles.searchButtonIcon}>o</Text>
              <Text style={styles.searchButtonText}>
                {loading ? "Searching..." : isBike ? "Search Bike Rides" : "Search Vayy Rides"}
              </Text>
            </TouchableOpacity>

            <View style={styles.recentSection}>
              <Text style={styles.recentHeading}>RECENT SEARCHES</Text>
              {recentSearches.map((item, index) => (
                <RecentRow key={index} item={item} onPress={() => applyRecent(item)} />
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8F8",
  },
  keyboard: {
    flex: 1,
  },
  content: {
    backgroundColor: "#F7F8F8",
    paddingBottom: 24,
    flexGrow: 1,
  },
  hero: {
    backgroundColor: "#F7F8F8",
    height: "35%",
    // width:"100%"
    overflow: "hidden",
  },
  heroImage: {
    // left: -35,
    width: "100%",
    height: "100%"
    // imageStyle:"contain"
  },
  heroOverlay: {
    backgroundColor: "rgba(247, 248, 248, 0.68)",
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: "54%",
  },
  heroCopy: {
    left: 16,
    position: "absolute",
    top: 32,
    zIndex: 4,
  },
  heroTitle: {
    color: "#03111F",
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 36,
  },
  heroTitleGreen: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 31,
  },
  heroSubtitle: {
    color: "#0F2A42",
    fontSize: 11.5,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: 12,
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
    alignItems: "start",
  },
  namasteIcon: {
    width: 40,
    height: 50,
    resizeMode: "contain",
    marginBottom: 2,
  },
  typeCursor: {
    width: 2,
    height: 32,
    backgroundColor: COLORS.primary,
    marginLeft: 2,
  },
  heroAccent: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.primary,
    lineHeight: 36,
  },
  heroSub: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4B5563",
    lineHeight: 24,
    marginTop: 16,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  heroOverlayAuto: {
    backgroundColor: "rgba(247, 248, 248, 0.68)",
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: "54%",
  },
  bikeHero: {
    height: 280,
    backgroundColor: "#F7F8F8",
    position: "relative",
    overflow: "hidden",
  },
  runningBike: {
    position: "absolute",
    bottom: 0,
    top: 135,
    width: width * 0.55,
    height: "70%",
    zIndex: 2,
  },
  road: {
    position: "absolute",
    bottom: 0,
    top: 250,
    left: 0,
    right: 0,
    height: 40,
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
  searchPanel: {
    backgroundColor: "#F2F4F7",
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    flex: 1,
    // marginTop: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 5,
    ...SHADOW.md,
  },
  locationField: {
    marginBottom: 20,
    zIndex: 10,
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 10,
  },
  pinIcon: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    height: 13,
    marginRight: 10,
    transform: [{ rotate: "45deg" }],
    width: 13,
  },
  fieldLabel: {
    color: "#061320",
    fontSize: 13.5,
    fontWeight: "900",
  },
  searchInputWrap: {
    alignItems: "center",
    borderColor: "#D8E1EA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchIcon: {
    color: "#8A99AE",
    fontSize: 14,
    marginRight: 8,
  },
  locationIcon: {
    color: "#7F90A8",
    fontSize: 15,
    marginLeft: 6,
  },
  searchInput: {
    color: "#102033",
    flex: 1,
    fontSize: 12.5,
    minHeight: 40,
    paddingVertical: 0,
  },
  dropdown: {
    backgroundColor: COLORS.white,
    borderColor: "#D8E1EA",
    borderRadius: 8,
    borderWidth: 1,
    left: 0,
    maxHeight: 190,
    position: "absolute",
    right: 0,
    ...SHADOW.sm,
    zIndex: 9999,
    elevation: 20,
  },
  resultRow: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    padding: SPACING.md,
  },
  resultTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  resultSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  searchingText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: SPACING.xs,
  },
  swapButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: COLORS.white,
    borderColor: "#E6EDF2",
    borderRadius: RADIUS.full,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    marginBottom: 15,
    marginTop: -3,
    width: 28,
    ...SHADOW.sm,
  },
  swapText: {
    color: "#344255",
    fontSize: 17,
    fontWeight: "900",
  },
  searchButton: {
    alignItems: "center",
    backgroundColor: "#7DCE9F",
    borderRadius: 9,
    flexDirection: "row",
    height: 46,
    justifyContent: "center",
    marginTop: 4,
    ...SHADOW.sm,
  },
  searchDisabled: {
    opacity: 0.72,
  },
  searchButtonIcon: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "900",
    marginRight: 10,
  },
  searchButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
  recentSection: {
    backgroundColor: "#F2F4F7",
    flex: 1,
    paddingTop: 20,
    paddingBottom: 40,
  },
  recentHeading: {
    color: "#93A0B3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 10,
  },
  recentRow: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: "#EDF1F4",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    height: 47,
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  clockCircle: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    marginRight: 11,
    width: 28,
  },
  clockText: {
    color: "#8EA0B6",
    fontSize: 15,
    fontWeight: "900",
  },
  recentCopy: {
    flex: 1,
  },
  recentFrom: {
    color: "#0F2032",
    fontSize: 9.5,
    fontWeight: "900",
  },
  recentTo: {
    color: "#5D7086",
    fontSize: 8.6,
    marginTop: 3,
  },
});
