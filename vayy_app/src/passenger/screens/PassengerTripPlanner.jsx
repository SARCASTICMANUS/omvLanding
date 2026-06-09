import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
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

const heroImage = require("../../../assets/trip.png");

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

  const fetchRecentSearches = async () => {
    try {
      setFetchingRecent(true);
      const response = await api.get("/api/passenger/recent-searches/");
      setRecentSearches(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch recent searches:", error);
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

    navigation.navigate("PassengerRouteList", { pickup, destination, mode });
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
          <ImageBackground
            imageStyle={styles.heroImage}
            resizeMode="cover"
            source={heroImage}
            style={styles.hero}
          >
            <View style={styles.heroOverlay} />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Choose Your</Text>
              <Text style={styles.heroTitleGreen}>Route</Text>
              <Text style={styles.heroSubtitle}>
                Enter your pickup and drop locations{"\n"}
                to find the best {isBike ? "bike" : "bus"} routes{"\n"}
                and track in real-time.
              </Text>
            </View>
          </ImageBackground>

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
                isBike && { backgroundColor: "#534AB7" },
                (!canProceed || loading) && styles.searchDisabled,
              ]}
            >
              <Text style={styles.searchButtonIcon}>o</Text>
              <Text style={styles.searchButtonText}>
                {loading ? "Searching..." : isBike ? "Search Bike Rides" : "Search Vayy Rides"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.recentSection}>
            <Text style={styles.recentHeading}>RECENT SEARCHES</Text>
            {recentSearches.map((item, index) => (
              <RecentRow key={index} item={item} onPress={() => applyRecent(item)} />
            ))}
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
    height:"100%"
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
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 31,
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
  searchPanel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    // marginTop: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    zIndex: 5,
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
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 58,
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
