import * as Location from "expo-location";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  Animated,
  Modal,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { setVehicleMode } from "../../store/slices/vehicleModeSlice";
import { MaterialIcons } from "@expo/vector-icons";
import { NOMINATIM_REVERSE } from "../../constants";
import {
  clearSelectedServiceCity,
  loadSelectedServiceCity,
  loadServiceCities,
  saveSelectedServiceCity,
} from "../../routes/services/serviceCityResolver";
import { findNearestServiceCity } from "../../routes/services/serviceCityMatching";

const AUTO_IMG = require("../../../assets/vayySideAuto.webp");
const BIKE_IMG = require("../../../assets/vayyPulsureBike.webp");
const NAMASTE_ICON = require("../../../assets/vayyNamaste.webp");

const GREEN = "#009849";
const GREEN_DARK = "#007a3a";
const WHITE = "#FFFFFF";
const BLACK = "#0D1B2A";
const TEXT_SEC = "#5A6B7D";
const TEXT_MUTED = "#94A3B8";
const BG = "#F5F7FA";

function ModeCard({ title, subtitle, badgeText, badgeIcon, onPress, image, cta }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  };

  return (
    <Animated.View style={[styles.modeCardWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.modeCard}
      >
        <View style={styles.modeCardContent}>
          <Text style={styles.modeTitle}>{title}</Text>
          <Text style={styles.modeSubtitle}>{subtitle}</Text>
          <View style={styles.modeCardBottom}>
            <View style={styles.modeBadge}>
              {badgeIcon}
              <Text style={styles.modeBadgeText}>{badgeText}</Text>
            </View>
            <View style={styles.modeCta}>
              <Text style={styles.modeCtaText}>{cta}</Text>
              <MaterialIcons name="chevron-right" size={16} color={GREEN} />
            </View>
          </View>
        </View>
        <View style={styles.modeImageWrap}>
          <Image source={image} style={styles.modeImage} resizeMode="contain" />
          <View style={styles.modeImageGlow} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PassengerHomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const displayName = user?.full_name || user?.name || user?.first_name || "there";

  const safeCityName = (() => {
    const c = user?.city;
    if (!c) return "Current location";
    if (typeof c === "string") return c;
    if (typeof c === "object") return c.name || c.city_name || String(c) || "Current location";
    return String(c);
  })();
  const [currentLoc, setCurrentLoc] = useState(safeCityName);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [locating, setLocating] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [subLine, setSubLine] = useState("");
  const [showName, setShowName] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cursorRef = useRef(new Animated.Value(1)).current;
  const locatingRef = useRef(false);
  const manualCityChoiceRef = useRef(false);
  const citySelectionVersionRef = useRef(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleGetLocation = useCallback(async ({ forceAuto = false } = {}) => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    const selectionVersion = citySelectionVersionRef.current;
    if (forceAuto) manualCityChoiceRef.current = false;
    setLocating(true);
    try {
      setLoadingCities(true);
      let availableCities = [];
      try {
        availableCities = await loadServiceCities();
      } catch {}
      setCities(availableCities);
      setLoadingCities(false);

      let savedCity = await loadSelectedServiceCity();
      if (savedCity && availableCities.length &&
          !availableCities.some((city) => String(city.id) === String(savedCity.id))) {
        await clearSelectedServiceCity();
        savedCity = null;
      }
      if (savedCity) setSelectedCity(savedCity);
      const keepManualCity = !forceAuto && savedCity?.source === "manual";
      if (keepManualCity) manualCityChoiceRef.current = true;

      let coords = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          coords = loc?.coords || null;
        }
      } catch {}

      if (coords) {
        const { latitude, longitude } = coords;
        let locationData = null;
        try {
          locationData = await NOMINATIM_REVERSE(latitude, longitude);
          const placeName =
            locationData?.name ||
            locationData?.address?.road ||
            locationData?.address?.neighbourhood ||
            locationData?.display_name?.split(",")?.[0];
          setCurrentLoc(placeName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setCurrentLoc(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }

        const locationCityName = locationData?.address?.city ||
          locationData?.address?.town ||
          locationData?.address?.municipality ||
          locationData?.address?.city_district;
        const geocodedCity = availableCities.find((city) =>
          String(city.name).toLowerCase() === String(locationCityName || "").toLowerCase()
        );
        const city = geocodedCity || findNearestServiceCity(latitude, longitude, availableCities);
        if (city && !manualCityChoiceRef.current && selectionVersion === citySelectionVersionRef.current) {
          const selected = await saveSelectedServiceCity(city, "auto");
          if (selectionVersion === citySelectionVersionRef.current && !manualCityChoiceRef.current) {
            setSelectedCity(selected || city);
          }
        } else if (!city && !manualCityChoiceRef.current && selectionVersion === citySelectionVersionRef.current) {
          await clearSelectedServiceCity();
          if (selectionVersion === citySelectionVersionRef.current && !manualCityChoiceRef.current) {
            setSelectedCity(null);
          }
        }
      } else if (!savedCity) {
        const profileCityName = typeof user?.city === "object"
          ? user.city?.name || user.city?.city_name
          : user?.city;
        const profileCity = availableCities.find((item) =>
          String(item.name).toLowerCase() === String(profileCityName || "").toLowerCase()
        );
        if (profileCity && !manualCityChoiceRef.current && selectionVersion === citySelectionVersionRef.current) {
          const selected = await saveSelectedServiceCity(profileCity, "auto");
          if (selectionVersion === citySelectionVersionRef.current && !manualCityChoiceRef.current) {
            setSelectedCity(selected || profileCity);
          }
        }
      }
    } catch {}
    finally {
      setLoadingCities(false);
      locatingRef.current = false;
      setLocating(false);
    }
  }, [user?.city]);

  const handleSelectCity = useCallback(async (city) => {
    citySelectionVersionRef.current += 1;
    manualCityChoiceRef.current = true;
    const selected = await saveSelectedServiceCity(city, "manual");
    setSelectedCity(selected || { ...city, source: "manual" });
    setShowCityPicker(false);
  }, []);
  
  useEffect(() => {
    handleGetLocation();
  }, [handleGetLocation]);

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

    return () => cursorAnim.stop();
  }, []);

  const handleAutoSearch = useCallback(() => {
    dispatch(setVehicleMode("AUTO"));
    navigation.navigate("PassengerTripPlanner", {
      cityId: selectedCity?.id,
      cityName: selectedCity?.name,
    });
  }, [dispatch, navigation, selectedCity]);

  const handleBikeBook = useCallback(() => {
    dispatch(setVehicleMode("BIKE"));
    navigation.navigate("PassengerTripPlanner", {
      mode: "bike",
      cityId: selectedCity?.id,
      cityName: selectedCity?.name,
    });
  }, [dispatch, navigation, selectedCity]);



  const handleSearchBarPress = useCallback(() => {
    dispatch(setVehicleMode("BIKE"));
    navigation.navigate("PassengerTripPlanner", {
      mode: "bike",
      cityId: selectedCity?.id,
      cityName: selectedCity?.name,
    });
  }, [dispatch, navigation, selectedCity]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <View style={styles.headerGradient}>
            <View style={styles.gradBase} />
            <View style={styles.gradRay1} />
            <View style={styles.gradRay2} />
          </View>

          <View style={styles.greetingSection}>
            <View style={styles.namasteRow}>
              <Image source={NAMASTE_ICON} style={styles.namasteIcon} resizeMode="contain" />
              <Text style={styles.namasteText}>{greeting}</Text>
              {greeting.length < 8 && <Animated.View style={[styles.typeCursor, { opacity: cursorRef }]} />}
            </View>

            {showName && <Text style={styles.nameText}>{displayName}</Text>}

            <View style={styles.subRow}>
              {subLine ? <Text style={styles.subText}>{subLine}</Text> : null}
              {subLine.length > 0 && subLine.length < 32 && (
                <Animated.View style={[styles.typeCursor, { height: 18 }, { opacity: cursorRef }]} />
              )}
            </View>
          </View>

          <View style={styles.locSection}>
            <View style={styles.locRow}>
              <View style={styles.locPinWrap}>
                <MaterialIcons name="location-on" size={22} color={WHITE} />
                <Animated.View style={[styles.locPulse, { opacity: pulseAnim }]} />
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Choose city. Current city: ${selectedCity?.name || "not selected"}`}
                activeOpacity={0.8}
                onPress={() => setShowCityPicker(true)}
                style={styles.locTextWrap}
              >
                <Text style={styles.locLabel}>YOUR CITY · TAP TO CHANGE</Text>
                <View style={styles.cityValueRow}>
                  <Text numberOfLines={1} style={styles.locValue}>
                    {selectedCity?.name || (locating ? "Finding your city…" : "Choose city")}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color={WHITE} />
                </View>
                <Text numberOfLines={1} style={styles.locSubValue}>Current location: {currentLoc}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Use my current city"
                disabled={locating}
                onPress={() => handleGetLocation({ forceAuto: true })}
                style={styles.gpsBtn}
                activeOpacity={0.7}
              >
                <View style={styles.gpsGlass} />
                <MaterialIcons name="my-location" size={18} color={WHITE} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.92} onPress={handleSearchBarPress} style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color={TEXT_MUTED} />
            <Text style={styles.searchPlaceholder}>Office, Metro ya College?</Text>
            <MaterialIcons name="mic" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        <ScrollView
          bounces={false}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Choose your ride</Text>

          <ModeCard
            title="Bike Ride"
            subtitle="Fast point-to-point ride."
            badgeText="Quick match"
            badgeIcon={<MaterialIcons name="bolt" size={12} color="#F5A623" />}
            onPress={handleBikeBook}
            image={BIKE_IMG}
            cta="Ride Now"
          />

          <View style={styles.modeSpacer} />

          <ModeCard
            title="Shared Auto"
            subtitle="Jo auto already aapke route par hai."
            badgeText="Live route matching"
            badgeIcon={<View style={styles.liveDot} />}
            onPress={handleAutoSearch}
            image={AUTO_IMG}
            cta="Ride Now"
          />
        </ScrollView>
      </Animated.View>
      <Modal
        animationType="fade"
        transparent
        visible={showCityPicker}
        onRequestClose={() => setShowCityPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            accessibilityLabel="Close city selector"
            activeOpacity={1}
            onPress={() => setShowCityPicker(false)}
            style={styles.modalBackdrop}
          />
          <View style={styles.cityModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose your city</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close city selector"
                onPress={() => setShowCityPicker(false)}
                style={styles.modalClose}
              >
                <MaterialIcons name="close" size={22} color={BLACK} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>Ride availability and routes will use this city.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={locating}
              onPress={() => {
                setShowCityPicker(false);
                handleGetLocation({ forceAuto: true });
              }}
              style={styles.useLocationOption}
            >
              <MaterialIcons name="my-location" size={19} color={GREEN} />
              <Text style={styles.useLocationText}>Use my current location</Text>
              {locating && <Text style={styles.loadingText}>Finding…</Text>}
            </TouchableOpacity>
            <ScrollView style={styles.cityList} keyboardShouldPersistTaps="handled">
              {loadingCities && cities.length === 0 ? (
                <Text style={styles.loadingText}>Loading cities…</Text>
              ) : cities.length ? cities.map((city) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={String(city.id)}
                  onPress={() => handleSelectCity(city)}
                  style={styles.cityOption}
                >
                  <Text style={styles.cityOptionText}>{city.name}</Text>
                  {String(selectedCity?.id) === String(city.id) && (
                    <MaterialIcons name="check-circle" size={20} color={GREEN} />
                  )}
                </TouchableOpacity>
              )) : (
                <Text style={styles.loadingText}>No service cities are available right now.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flex: 0.52,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    justifyContent: "space-between",
    backgroundColor: GREEN,
    overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradBase: {
    ...StyleSheet.absoluteFill,
    backgroundColor: GREEN,
  },
  gradRay1: {
    position: "absolute",
    top: -60,
    right: -40,
    width: "70%",
    height: "90%",
    backgroundColor: "#00B857",
    opacity: 0.25,
    borderRadius: 120,
    transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute",
    top: -80,
    right: -20,
    width: "50%",
    height: "70%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100,
    transform: [{ rotate: "35deg" }],
  },

  // ── Greeting ──────────────────────────────────────────────────────────────
  greetingSection: {
    marginTop: 32,
  },
  namasteRow: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  namasteIcon: {
    width: 30,
    height: 38,
    marginBottom: 6,
  },
  namasteText: {
    fontSize: 28,
    fontWeight: "900",
    color: WHITE,
    lineHeight: 34,
  },
  typeCursor: {
    width: 2,
    height: 28,
    backgroundColor: WHITE,
    marginLeft: 2,
  },
  nameText: {
    fontSize: 28,
    fontWeight: "900",
    color: WHITE,
    lineHeight: 34,
    marginBottom: 2,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
  },
  subText: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 22,
  },

  // ── Location ──────────────────────────────────────────────────────────────
  locSection: {
    marginTop: 4,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locPinWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  locPulse: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  locTextWrap: {
    flex: 1,
  },
  locLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  locValue: {
    flex: 1,
    fontSize: 14,
    color: WHITE,
    fontWeight: "700",
  },
  cityValueRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  locSubValue: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 1,
  },
  gpsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  gpsGlass: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  cityModal: {
    backgroundColor: WHITE,
    borderRadius: 20,
    maxHeight: "75%",
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 16,
    width: "100%",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: BLACK,
    fontSize: 19,
    fontWeight: "800",
  },
  modalClose: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  modalHint: {
    color: TEXT_SEC,
    fontSize: 13,
    marginBottom: 12,
  },
  useLocationOption: {
    alignItems: "center",
    borderBottomColor: "#E5E7EB",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 14,
  },
  useLocationText: {
    color: GREEN_DARK,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  cityList: {
    flexShrink: 1,
    maxHeight: 360,
    marginBottom: 8,
  },
  cityOption: {
    alignItems: "center",
    borderBottomColor: "#F1F3F5",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: 10,
  },
  cityOptionText: {
    color: BLACK,
    fontSize: 15,
    fontWeight: "600",
  },
  loadingText: {
    color: TEXT_SEC,
    fontSize: 12,
  },

  // ── Search Bar ────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 4,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: TEXT_MUTED,
    fontWeight: "500",
    marginLeft: 10,
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: {
    flex: 0.48,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: BLACK,
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // ── Mode Cards ────────────────────────────────────────────────────────────
  modeCardWrap: {
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  modeCard: {
    backgroundColor: WHITE,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    paddingTop: "20",
    paddingBottom: "20",
  },
  modeCardContent: {
    flex: 1,
    paddingLeft: 18,
    paddingVertical: 18,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: BLACK,
    marginBottom: 4,
  },
  modeSubtitle: {
    fontSize: 13,
    color: TEXT_SEC,
    fontWeight: "500",
    lineHeight: 18,
    marginBottom: 14,
  },
  modeCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5EE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: GREEN,
  },
  modeCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingRight: 4,
  },
  modeCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
  },
  modeImageWrap: {
    width: 120,
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    marginRight: -4,
  },
  modeImage: {
    width: 110,
    height: 140,
  },
  modeImageGlow: {
    position: "absolute",
    bottom: -10,
    width: 80,
    height: 20,
    borderRadius: 40,
    backgroundColor: "rgba(0,152,73,0.08)",
  },
  modeSpacer: {
    height: 14,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#3DB862",
  },
});
