import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { getRecentSearches, saveRecentSearch, searchRoutesByLocation } from "../services/passengerService";
import LocationSearch from "../../shared/components/common/LocationSearch";

import COLORS from "../../shared/constants/colors";
import SHADOW from "../../shared/constants/shadow";

const { width } = Dimensions.get("window");

const heroImage = require("../../../assets/new-bg1.png");
const heroBikeBg = require("../../../assets/new-bg1.png");

const AUTO_VARIANTS = [
  require("../../../assets/vayyWithPassengerAuto.webp"),
  require("../../../assets/vayyWithoutPassengerAuto.webp"),
];

const passengerBikeImages = [
  require("../../../assets/vayyWithPassengerbike.webp"),
  require("../../../assets/vayyWithPassengerbike2.webp"),
  require("../../../assets/vayyWithPassengerbike3.webp"),
  require("../../../assets/vayyWithoutPassengerBike.webp"),
  require("../../../assets/vayyWithoutPassengerBike2.webp"),
  require("../../../assets/vayyWithoutPassengerBike3.webp"),
  require("../../../assets/vayyWithoutPassengerBike4.webp"),
];

function RecentRow({ item, onPress }) {
  const fromName = item.pickup?.name || item.pickup?.display_name || "Unknown Start";
  const toName = item.destination?.name || item.destination?.display_name || "Unknown End";

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.recentRow}>
      <View style={styles.clockCircle}>
        <Ionicons name="time-outline" size={18} color="#6B7280" />
      </View>
      <View style={styles.recentCopy}>
        <Text numberOfLines={1} style={styles.recentFrom}>
          {fromName}
        </Text>
        <Text numberOfLines={1} style={styles.recentTo}>
          To: {toName}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

export default function PassengerTripPlanner({ navigation, route }) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [fetchingRecent, setFetchingRecent] = useState(false);
  const [searching, setSearching] = useState(false);
  const loading = route?.params?.loading || false;
  const mode = route?.params?.mode || "auto";
  const isBike = mode === "bike";
  const [imgIndex, setImgIndex] = useState(0);
  const [autoImgIndex, setAutoImgIndex] = useState(0);
  const bikeX = useRef(new Animated.Value(0)).current;
  const bikeOpacity = useRef(new Animated.Value(1)).current;
  const autoX = useRef(new Animated.Value(0)).current;
  const autoOpacity = useRef(new Animated.Value(1)).current;

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
          setImgIndex((prev) => (prev + 1) % passengerBikeImages.length);
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

  useEffect(() => {
    if (isBike) return undefined;
    const runAutoCycle = () => {
      autoX.setValue(0);
      autoOpacity.setValue(1);
      Animated.timing(autoX, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        Animated.timing(autoOpacity, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }).start(() => {
          autoX.setValue(0);
          setAutoImgIndex((prev) => (prev + 1) % AUTO_VARIANTS.length);
          Animated.timing(autoOpacity, {
            toValue: 1,
            duration: 60,
            useNativeDriver: true,
          }).start();
          runAutoCycle();
        });
      });
    };
    runAutoCycle();
    return () => {
      autoX.stopAnimation();
      autoOpacity.stopAnimation();
    };
  }, [isBike]);

  const fetchRecentSearches = async () => {
    try {
      setFetchingRecent(true);
      const data = await getRecentSearches();
      setRecentSearches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch recent searches:", error);
      setRecentSearches([]);
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

  const handleNext = async () => {
    if (!canProceed || loading || searching) {
      return;
    }

    setSearching(true);

    try {
      await saveRecentSearch({
        pickup_name: pickup?.name || pickup?.display_name || "",
        pickup_lat: pickup.lat,
        pickup_lon: pickup.lon,
        destination_name: destination?.name || destination?.display_name || "",
        destination_lat: destination.lat,
        destination_lon: destination.lon,
      });

      const trips = await searchRoutesByLocation(
        pickup.lat,
        pickup.lon,
        destination.lat,
        destination.lon,
      );

      navigation.navigate("PassengerRouteList", { pickup, destination, mode, trips, loading: false });
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
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

  const searchPanelContent = isBike ? (
    <>
      <LocationSearch
        key={`pickup-${pickup?.display_name || pickup?.name || "empty"}`}
        isPickup
        label="Pickup Stop"
        onSelect={setPickup}
        placeholder="Search pickup location"
        value={pickup}
      />

      <TouchableOpacity activeOpacity={0.8} onPress={handleSwap} style={styles.swapButton}>
        <Ionicons name="swap-vertical" size={20} color="#009849" />
      </TouchableOpacity>

      <LocationSearch
        key={`destination-${destination?.display_name || destination?.name || "empty"}`}
        dropdownLift={90}
        isPickup={false}
        label="Destination"
        onSelect={setDestination}
        placeholder="Enter your destination"
        value={destination}
      />

      <TouchableOpacity
        activeOpacity={0.86}
        disabled={!canProceed || loading || searching}
        onPress={handleNext}
        style={[
          styles.searchButton,
          isBike && { backgroundColor: COLORS.primary },
          (!canProceed || loading || searching) && styles.searchDisabled,
        ]}
      >
        <MaterialIcons name="search" size={18} color={COLORS.white} />
        <Text style={styles.searchButtonText}>
          {searching || loading ? "Searching..." : isBike ? "Search Bike Rides" : "Search Vayy Rides"}
        </Text>
      </TouchableOpacity>

      <View style={styles.recentSection}>
        <Text style={styles.recentHeading}>RECENT SEARCHES</Text>
        {recentSearches.map((item, index) => (
          <RecentRow key={index} item={item} onPress={() => applyRecent(item)} />
        ))}
      </View>
    </>
  ) : (
    <View style={styles.comingSoonCard}>
      <Image source={require("../../../assets/vayyAutoBoarding.webp")} style={styles.comingSoonImage} resizeMode="contain" />
      <Text style={styles.comingSoonTitle}>Coming Soon</Text>
      <Text style={styles.comingSoonText}>
        Shared Auto matching is coming soon. Please try Bike Ride for now.
      </Text>
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar backgroundColor="#F7F8F8" style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboard}
      >
        <View style={styles.bikeContainer}>
          <View style={isBike ? styles.bikeHero : styles.autoHero}>
            {isBike ? (
              <>
                <Image source={heroBikeBg} style={styles.bikeHeroBg} resizeMode="cover" />
                <Animated.Image
                  source={passengerBikeImages[imgIndex]}
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
                <View style={styles.bikeShadow} />
              </>
            ) : (
              <>
                <Image source={heroImage} style={styles.autoHeroBg} resizeMode="cover" />
                <Animated.Image
                  source={AUTO_VARIANTS[autoImgIndex]}
                  style={[
                    styles.autoVehicle,
                    { opacity: autoOpacity },
                    {
                      transform: [
                        {
                          translateX: autoX.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-width * 0.5, width + 80],
                          }),
                        },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                />
              </>
            )}
          </View>
          <ScrollView
            bounces={false}
            style={styles.bikeScrollCard}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {searchPanelContent}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffffff",
  },
  keyboard: {
    flex: 1,
  },
  content: {
    backgroundColor: "#ffffffff",
    paddingBottom: 24,
    flexGrow: 1,
  },
  autoHero: {
    height: 300,
    position: "relative",
    overflow: "hidden",
  },
  autoHeroBg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  autoVehicle: {
    position: "absolute",
    bottom: 30,
    width: 140,
    height: 100,
    zIndex: 3,
  },
  bikeContainer: {
    flex: 1,
  },
  bikeHero: {
    height: 300,
    position: "relative",
    overflow: "hidden",
  },
  bikeHeroBg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  bikeScrollCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    marginTop: -20,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 10,
    ...SHADOW.md,
  },
  bikeShadow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(0,0,0,0)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 3,
  },
  runningBike: {
    position: "absolute",
    bottom: 15,
    width: width * 0.5,
    height: 120,
    zIndex: 2,
  },

  swapButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 999,
    borderWidth: 1.5,
    height: 32,
    justifyContent: "center",
    marginBottom: 14,
    marginTop: -6,
    width: 32,
    ...SHADOW.sm,
    zIndex: 5,
  },
  searchButton: {
    alignItems: "center",
    backgroundColor: "#009849",
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    height: 52,
    justifyContent: "center",
    marginTop: 8,
    ...SHADOW.md,
  },
  searchDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  recentSection: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 40,
  },
  comingSoonCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 12,
  },
  comingSoonImage: {
    width: 160,
    height: 120,
  },
  comingSoonTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  comingSoonText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
  },
  recentHeading: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  recentRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F3F4F6",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  clockCircle: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  recentCopy: {
    flex: 1,
    gap: 2,
  },
  recentFrom: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
  },
  recentTo: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "500",
  },
});
