import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../constants";
import Svg, { Path, Circle, Rect, Line, Text as SvgText } from "react-native-svg";
import COLORS from "../../shared/constants/colors";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    key: "waiting",
    title: "Tired of Waiting?",
    subtitle: "Long ETAs, ride cancellations, surge pricing. Traditional ride-hailing wastes your time. VAYY is different.",
  },
  {
    key: "discover",
    title: "See Rides on Your Route",
    subtitle: "Discover autos and bikes already moving your way. Vehicles pass your stop — you just raise your hand.",
  },
  {
    key: "action",
    title: "Walk. Raise Hand. Go.",
    subtitle: "Walk to your nearest stop, raise your hand as the vehicle approaches, and board instantly. No booking needed.",
  },
  {
    key: "benefit",
    title: "Smart Commuting, Lower Fares",
    subtitle: "Predictable shared fares starting at ₹15. Live tracking, route-based matching. Smarter daily commutes with VAYY.",
  },
];

function ClockIcon() {
  return (
    <Svg width={200} height={200} viewBox="0 0 200 200" fill="none">
      <Circle cx="100" cy="100" r="85" stroke="#009849" strokeWidth="5" fill="#F0FDF4" />
      <Circle cx="100" cy="100" r="75" stroke="#009849" strokeWidth="2" strokeDasharray="10 6" fill="none" opacity="0.4" />
      <Line x1="100" y1="100" x2="100" y2="55" stroke="#009849" strokeWidth="5" strokeLinecap="round" />
      <Line x1="100" y1="100" x2="135" y2="115" stroke="#009849" strokeWidth="4" strokeLinecap="round" />
      <Circle cx="100" cy="100" r="7" fill="#009849" />
      <Path d="M150 50 L170 30 M170 50 L150 30" stroke="#6B7280" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <Circle cx="160" cy="40" r="12" fill="#FEE2E2" />
      <SvgText textAnchor="middle" x="160" y="45" fontSize="14" fontWeight="bold" fill="#EF4444">!</SvgText>
    </Svg>
  );
}

function RouteIcon() {
  return (
    <Svg width={200} height={200} viewBox="0 0 200 200" fill="none">
      <Path d="M20 160 Q60 40 100 100 Q140 160 180 60" stroke="#009849" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.3" />
      <Path d="M20 100 Q60 60 100 130 Q140 80 180 100" stroke="#009849" strokeWidth="3" strokeLinecap="round" fill="none" />
      <Circle cx="40" cy="70" r="8" fill="#009849" />
      <Circle cx="90" cy="50" r="6" fill="#00E676" />
      <Circle cx="140" cy="90" r="7" fill="#FF9800" />
      <Circle cx="170" cy="50" r="8" fill="#009849" />
      <Path d="M38 68 L34 55 M42 68 L46 55" stroke="#009849" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M168 48 L164 35 M172 48 L176 35" stroke="#009849" strokeWidth="2.5" strokeLinecap="round" />
      <Rect x="80" y="140" width="40" height="6" rx="3" fill="#009849" />
      <Rect x="90" y="150" width="20" height="6" rx="3" fill="#00E676" />
      <Circle cx="100" cy="170" r="12" fill="#009849" opacity="0.15" />
      <Circle cx="100" cy="170" r="6" fill="#009849" />
    </Svg>
  );
}

function HandIcon() {
  return (
    <Svg width={200} height={200} viewBox="0 0 200 200" fill="none">
      <Path d="M60 110 Q55 80 65 60 Q70 50 80 52 Q85 54 85 65" stroke="#009849" strokeWidth="4" strokeLinecap="round" fill="none" />
      <Path d="M85 65 Q90 55 98 50 Q104 48 108 52 Q112 56 110 65" stroke="#009849" strokeWidth="4" strokeLinecap="round" fill="none" />
      <Path d="M110 65 Q115 55 122 50 Q128 48 132 52 Q136 58 132 68" stroke="#009849" strokeWidth="4" strokeLinecap="round" fill="none" />
      <Path d="M132 68 Q138 60 145 58 Q150 57 154 62 Q158 68 152 78" stroke="#009849" strokeWidth="4" strokeLinecap="round" fill="none" />
      <Path d="M60 110 L60 180 L152 180 L152 78" stroke="#009849" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
      <Circle cx="106" cy="175" r="35" fill="#009849" opacity="0.1" />
      <Path d="M96 175 L103 182 L116 168" stroke="#00E676" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M40 175 L170 175" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="6 4" />
      <Rect x="75" y="15" width="50" height="12" rx="6" fill="#009849" opacity="0.2" />
    </Svg>
  );
}

function SmartIcon() {
  return (
    <Svg width={200} height={200} viewBox="0 0 200 200" fill="none">
      <Rect x="20" y="30" width="160" height="110" rx="16" fill="#F0FDF4" stroke="#009849" strokeWidth="3" />
      <Rect x="35" y="45" width="130" height="8" rx="4" fill="#009849" opacity="0.15" />
      <Path d="M40 65 Q60 55 80 65 Q100 75 120 65 Q140 55 155 62" stroke="#009849" strokeWidth="2.5" fill="none" />
      <Circle cx="60" cy="80" r="5" fill="#009849" />
      <Circle cx="100" cy="85" r="4" fill="#00E676" />
      <Circle cx="145" cy="82" r="5" fill="#FF9800" />
      <Rect x="40" y="100" width="60" height="20" rx="8" fill="#009849" opacity="0.1" />
      <SvgText x="48" y="114" fontSize="11" fontWeight="bold" fill="#009849">₹15</SvgText>
      <Rect x="110" y="100" width="50" height="20" rx="8" fill="#F0FDF4" stroke="#009849" strokeWidth="1" />
      <SvgText x="118" y="114" fontSize="9" fontWeight="bold" fill="#009849">LIVE</SvgText>
      <Path d="M40 155 Q50 145 70 155 Q90 165 110 155 Q130 145 150 155 L160 155" stroke="#009849" strokeWidth="2" fill="none" opacity="0.3" />
      <Circle cx="50" cy="185" r="8" fill="#00E676" opacity="0.6" />
      <Circle cx="100" cy="185" r="8" fill="#009849" opacity="0.6" />
      <Circle cx="150" cy="185" r="8" fill="#00E676" opacity="0.6" />
    </Svg>
  );
}

const ILLUSTRATIONS = [ClockIcon, RouteIcon, HandIcon, SmartIcon];

function Slide({ item, index }) {
  const Illustration = ILLUSTRATIONS[index];
  return (
    <View style={styles.slide}>
      <View style={styles.illustrationArea}>
        <Illustration />
      </View>
      <View style={styles.textArea}>
        <Text style={styles.indexLabel}>0{index + 1}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );
}

export default function SplashCarouselScreen({ navigation }) {
  const flatRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  }, []);

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleDone();
    }
  };

  const handleDone = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.onboardingDone, "true");
    } catch {}
    try {
      navigation.replace("AuthNavigator");
    } catch {
      navigation.goBack();
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.onboardingDone, "true");
    } catch {}
    try {
      navigation.replace("AuthNavigator");
    } catch {
      navigation.goBack();
    }
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => <Slide item={item} index={index} />}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{isLast ? "Get Started" : "Next"}</Text>
          {!isLast && (
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  skipBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 12 : 8,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  slide: {
    width,
    flex: 1,
  },
  illustrationArea: {
    flex: 1.2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFFFA",
  },
  textArea: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 8,
    justifyContent: "flex-start",
  },
  indexLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    lineHeight: 34,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textMuted,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === "android" ? 24 : 12,
    paddingTop: 16,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    width: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  nextBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  nextText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
