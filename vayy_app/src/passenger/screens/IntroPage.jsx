import * as Location from "expo-location";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { setVehicleMode } from "../../store/slices/vehicleModeSlice";
import Svg, {
  Path,
  Circle,
  Rect,
} from "react-native-svg";

// Assets
const AUTO_IMG = require("../../../assets/vayyAuto.png");
const BIKE_IMG = require("../../../assets/bike.png");
const TRIP_IMG = require("../../../assets/trip.png");

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  green:        "#1E8A3C",   // primary VAYY green
  greenDark:    "#166B2E",
  greenDot:     "#3DB862",   // live dot
  bg:           "#EEEEEE",   // overall page bg (light grey)
  heroBg:       "#EEF5EE",   // hero section bg
  white:        "#FFFFFF",
  black:        "#141414",
  text1:        "#222222",
  text2:        "#555555",
  text3:        "#999999",
  border:       "#DDDDDD",

  cardShadow:   "#00000014",
};

// ─── SVG Icon Components ──────────────────────────────────────────────────────

/** Map pin / location */
const IconPin = ({ size = 24, color = C.green }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      fill={color}
    />
    <Circle cx="12" cy="9" r="2.5" fill={C.white} />
  </Svg>
);

/** GPS / crosshair target */
const IconGPS = ({ size = 20, color = C.text2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
    <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

/** Search / magnifying glass */
const IconSearch = ({ size = 20, color = C.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.2" />
    <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

/** Chevron right arrow */
const IconChevron = ({ size = 16, color = C.text2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Home icon (filled) */
const IconHome = ({ size = 24, color = C.green }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" fill={color} />
    <Rect x="9" y="13" width="6" height="8" rx="1" fill={C.white} />
  </Svg>
);

/** Route / exchange arrows */
const IconRoutes = ({ size = 24, color = C.text3 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 16V4m0 0L4 7m3-3l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M17 8v12m0 0l3-3m-3 3l-3-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Live map pin with pulse */
const IconMap = ({ size = 24, color = C.text3 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={color} strokeWidth="2" fill="none" />
    <Circle cx="12" cy="9" r="2.5" fill={color} />
  </Svg>
);

/** Bell alert */
const IconAlert = ({ size = 24, color = C.text3 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

/** Profile circle */
const IconProfile = ({ size = 24, color = C.text3 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
    <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

/** Lightning bolt (quick booking) */
const IconBolt = ({ size = 13, color = "#F5A623" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M13 2L4.5 13.5H11L10 22l9.5-12H14L13 2z" />
  </Svg>
);

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────
// function BottomTabBar({ navigation }) {
//   const tabs = [
//     { label: "Home",     Icon: IconHome,    active: true,  screen: null },
//     { label: "Routes",   Icon: IconRoutes,  active: false, screen: "PassengerRoutes" },
//     { label: "Live Map", Icon: IconMap,     active: false, screen: "PassengerTripPlanner" },
//     { label: "Alerts",   Icon: IconAlert,   active: false, screen: "PassengerAlerts" },
//     { label: "Profile",  Icon: IconProfile, active: false, screen: "ProfileScreen" },
//   ];

//   return (
//     <View style={styles.tabBar}>
//       {tabs.map((tab) => {
//         return (
//           <TouchableOpacity
//             key={tab.label}
//             style={styles.tabItem}
//             onPress={() => tab.screen && navigation.navigate(tab.screen)}
//             activeOpacity={0.7}
//           >
//             {tab.active ? (
//               <View style={styles.tabActiveIconWrap}>
//                 <tab.Icon size={22} color={C.green} />
//               </View>
//             ) : (
//               <tab.Icon size={22} color={C.text3} />
//             )}
//             <Text style={[styles.tabLabel, tab.active && styles.tabLabelActive]}>
//               {tab.label}
//             </Text>
//           </TouchableOpacity>
//         );
//       })}
//     </View>
//   );
// }

// ─── Service Card ─────────────────────────────────────────────────────────────
function ServiceCard({ title, subtitle, badge, BadgeIcon, onPress, active, vehicleImg }) {
  return (
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={styles.scMainRow}>
        <View style={styles.scTextContainer}>
          <Text style={styles.scTitle}>{title}</Text>
          <Text style={styles.scSubtitle}>{subtitle}</Text>
        </View>
        <Image source={vehicleImg} style={styles.scVehicleImg} resizeMode="contain" />
      </View>

      {/* Bottom row: badge + arrow */}
      <View style={styles.scBottom}>
        <View style={styles.scBadge}>
          {BadgeIcon ? <BadgeIcon /> : null}
          <Text style={styles.scBadgeText}>{badge}</Text>
        </View>
        <View style={styles.scArrow}>
          <IconChevron size={14} color={C.text1} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PassengerHomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const displayName = user?.full_name || user?.name || user?.first_name || "there";

  const [currentLoc, setCurrentLoc] = useState(user?.city || "Current location");

  // ── Handlers (original logic preserved) ──
  const handleAutoSearch = () => {
    dispatch(setVehicleMode("AUTO"));
    navigation.navigate("PassengerTripPlanner");
  };

  const handleBrowseRoutes = () => {
    navigation.navigate("PassengerRoutes");
  };

  const handleBikeBook = () => {
    dispatch(setVehicleMode("BIKE"));
    navigation.navigate("PassengerTripPlanner", { mode: "bike" });
  };

  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      const latStr = latitude.toFixed(4);
      const lonStr = longitude.toFixed(4);
      setCurrentLoc(`${latStr}, ${lonStr}`);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.heroBg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ════ HERO SECTION ════ */}
        <View style={styles.hero}>
          <Image source={TRIP_IMG} style={styles.heroBgImg} resizeMode="cover" />

          <View style={styles.heroText}>
            <View style={styles.greetingRow}>
              <Image source={require("../../../assets/vayyNamaste.png")} style={styles.namasteIcon} />
              <Text style={styles.heroTitle}>Namaste,</Text>
            </View>
            <Text style={styles.heroAccent}>{displayName}</Text>
          </View>
        </View>

        {/* ════ LOCATION + SEARCH CARD ════ */}
        <View style={styles.searchCard}>

          {/* Location row */}
          <View style={styles.locRow}>
            <View style={styles.locLeft}>
              <IconPin size={28} color={C.green} />
              <View style={styles.locTexts}>
                <Text style={styles.locLabel}>Current location</Text>
                <Text style={styles.locValue}>{currentLoc}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.gpsBtn} onPress={handleGetLocation} activeOpacity={0.75}>
              <IconGPS size={18} color={C.text2} />
            </TouchableOpacity>
          </View>

          {/* Dashed separator */}
          <View style={styles.dashedLine} />

          {/* Search prompt text */}
          <Text style={styles.promptTitle}>Find shared autos on your route</Text>
          <Text style={styles.promptSub}>Search live routes with available autos</Text>

          {/* Browse Routes button */}
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleBrowseRoutes}
            activeOpacity={0.87}
          >
            <IconSearch size={19} color={C.white} />
            <Text style={styles.searchBtnText}>Browse Routes</Text>
          </TouchableOpacity>

        </View>

        {/* ════ SERVICE CARDS ROW ════ */}
        <View style={styles.cardsRow}>

          {/* Shared Auto Card (active / selected) */}
          <ServiceCard
            title="Shared Auto"
            subtitle={"Route based\ncommuting"}
            badge="Live route matching"
            BadgeIcon={() => (
              <View style={styles.liveDot} />
            )}
            onPress={handleAutoSearch}
            active
            vehicleImg={AUTO_IMG}
          />

          {/* Bike Ride Card */}
          <ServiceCard
            title="Bike Ride"
            subtitle={"Direct point-to-\npoint ride"}
            badge="Quick booking"
            BadgeIcon={() => (
              <IconBolt size={12} color="#F5A623" />
            )}
            onPress={handleBikeBook}
            active={false}
            vehicleImg={BIKE_IMG}
          />

        </View>

      </ScrollView>

      {/* ════ BOTTOM TAB BAR ════ */}
      {/* <BottomTabBar navigation={navigation} /> */}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: C.white,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    // backgroundColor: C.heroBg,
    // paddingHorizontal: 20,
    // position: "relative",
    // top:70,
    height:"40%",
    // width:"100%",
    // overflow: "hidden",
  },
  heroBgImg: {
    position: "absolute",
    // z-Index:-10,
    // top: 70,
    // left: 0,
    // right: 0,
    // bottom: 0,
    width: "100%",
    height: "100%",
  },
  heroText: {
    flex: 1,
    // backgroundColor:C.green,
    width:"100%",
    marginTop:60,
    marginLeft:20,
    paddingTop: 1, // Adjusted for status bar area
    zIndex: 2,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  namasteIcon: {
    width: 36,
    height: 36,
    marginRight: 6,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: C.black,
    lineHeight: 34,
  },
  heroAccent: {
    fontSize: 30,
    fontWeight: "900",
    color: C.green,
    lineHeight: 34,
  },

  // avatarBtn: {
  //   width: 44,
  //   height: 44,
  //   marginTop: 44, // Adjusted for status bar area
  //   borderRadius: 22,
  //   backgroundColor: C.green,
  //   justifyContent: "center",
  //   alignItems: "center",
  //   shadowColor: "#000",
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.10,
  //   shadowRadius: 6,
  //   elevation: 4,
  //   zIndex: 2,
  // },

  // ── Search Card ───────────────────────────────────────────────────────────
  searchCard: {
    backgroundColor: C.white,
    borderTopLeftRadius:18,
    borderTopRightRadius:18,
    // marginHorizontal: 14,
    marginTop: -22, // Overlap the hero section
    padding: 20,
    shadowColor: C.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 10,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  locLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  locTexts: {
    marginLeft: 8,
    flex: 1,
  },
  locLabel: {
    fontSize: 12,
    color: C.text3,
    fontWeight: "400",
    marginBottom: 2,
  },
  locValue: {
    fontSize: 16,
    color: C.black,
    fontWeight: "700",
  },
  gpsBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  dashedLine: {
    borderBottomWidth: 1.5,
    borderBottomColor: C.border,
    borderStyle: "dashed",
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 15,
    color: C.text1,
    fontWeight: "600",
    marginBottom: 3,
  },
  promptSub: {
    fontSize: 13,
    color: C.text3,
    fontWeight: "400",
    marginBottom: 18,
  },
  searchBtn: {
    backgroundColor: C.green,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  searchBtnText: {
    color: C.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    letterSpacing: 0.2,
  },

  // ── Service Cards Row ─────────────────────────────────────────────────────
  cardsRow: {
    flexDirection: "column",
    gap: 12,
    marginHorizontal: 25,
    marginTop: 1,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 20,    
    padding: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    shadowColor: "#00000010",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },

  scMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  scTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  scVehicleImg: {
    width: 130,
    height: 100,
    // backgroundColor:C.green,
  },
  scTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.black,
    marginBottom: 3,
  },
  scSubtitle: {
    fontSize: 12,
    color: C.text3,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: 14,
  },
  scBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 30,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 5,
    shadowColor: "#00000010",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  scBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: C.text1,
    marginLeft: 4,
  },
  scArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
    justifyContent: "center",
    alignItems: "center",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.greenDot,
  },

  // ── Bottom Tab Bar ────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabActiveIconWrap: {
    width: 44,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "400",
    color: C.text3,
    marginTop: 2,
  },
  tabLabelActive: {
    color: C.green,
    fontWeight: "600",
  },
});
