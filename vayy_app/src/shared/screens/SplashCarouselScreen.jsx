import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { STORAGE_KEYS } from "../../constants";
import COLORS from "../constants/colors";

const { width, height } = Dimensions.get("window");

/**
 * Session-scoped record of whether the onboarding carousel has been dealt with.
 *
 * `AppNavigator` keys its `NavigationContainer` on the auth role, so the whole
 * navigator is torn down and rebuilt on every login / logout. React state does
 * not survive that, so the "has the user already seen the carousel" decision
 * lived only in a `useState` that was still `true` after the user finished it —
 * and `initialRouteName` then pointed back at `SplashCarousel` on every
 * remount. Keeping it at module scope means the carousel is resolved at most
 * once per JS session, and the AsyncStorage flag is the durable source of truth
 * across cold starts.
 */
export const onboardingSession = {
  /** Has the async storage read completed for this session? */
  decided: false,
  /** Should the carousel be shown right now? */
  pending: false,
  decide(pending) {
    onboardingSession.decided = true;
    onboardingSession.pending = pending;
  },
  complete() {
    onboardingSession.decided = true;
    onboardingSession.pending = false;
  },
};

const SPLASH_IMAGES = [
  { key: "splash1", source: require("../../../assets/splash1.png"), headline: "Still Waiting?", subtitle: "Your daily commute shouldn't start with a long wait." },
  { key: "splash2", source: require("../../../assets/splash2.png"), headline: "Too Crowded.\nToo Slow.", subtitle: "Skip packed buses and unpredictable waits." },
  { key: "splash3", source: require("../../../assets/splash3.png"), headline: "Someone's Already\nGoing Your Way.", subtitle: "Find a ride already moving along your route." },
  { key: "splash4", source: require("../../../assets/splash4.png"), headline: "Share the Journey.", subtitle: "Marshals pick up Buddies along their route." },
  { key: "splash5", source: require("../../../assets/splash5.png"), headline: "Stop Waiting.\nStart Moving.", subtitle: "Join OMV" },
];

function Slide({ item }) {
  return (
    <View style={styles.slide}>
      <Image source={item.source} style={styles.slideImage} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgb(230, 232, 235)", "#FFFFFF"]}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
      />
      <View style={styles.textOverlay}>
        <Text style={styles.headlineText}>
          {item.headline.split("\n").map((line, i, arr) => (
            <Text key={i}>{line}{i < arr.length - 1 ? "\n" : ""}</Text>
          ))}
        </Text>
        <Text style={styles.subtitleText}>{item.subtitle}</Text>
      </View>
    </View>
  );
}

export default function SplashCarouselScreen({ navigation, route }) {
  const flatRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const nextRoute = route?.params?.next || "AuthNavigator";

  const onScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  }, []);

  const goNext = () => {
    if (currentIndex < SPLASH_IMAGES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      finish();
    }
  };

  const finish = async () => {
    // Flip the session flag before the async write so a login/logout remount in
    // the meantime can never route back into the carousel.
    onboardingSession.complete();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.onboardingDone, "true");
    } catch {}
    try {
      navigation.reset({ index: 0, routes: [{ name: nextRoute }] });
    } catch {
      navigation.goBack();
    }
  };

  const isLast = currentIndex === SPLASH_IMAGES.length - 1;

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <FlatList
        ref={flatRef}
        data={SPLASH_IMAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <Slide item={item} />}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SPLASH_IMAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{isLast ? "Join" : "Next"}</Text>
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
  slide: {
    width,
    height,
  },
  slideImage: {
    width: width,
    height: height,
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  textOverlay: {
    position: "absolute",
    bottom: 120,
    left: 32,
    right: 32,
  },
  headlineText: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 8,
    lineHeight: 22,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingBottom: 40,
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
