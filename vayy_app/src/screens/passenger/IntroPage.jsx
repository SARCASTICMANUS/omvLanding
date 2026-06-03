import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import VayyButton from "../../components/common/VayyButton";
import VayyCard from "../../components/common/VayyCard";
import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";

const features = [
  { title: "Live Tracking", copy: "See your bus move in real time." },
  { title: "Smart Routes", copy: "Find the best route for every trip." },
  { title: "Timely Alerts", copy: "Stay ready before your bus arrives." },
  { title: "Safe & Reliable", copy: "Travel with confidence every day." },
];

export default function IntroPage({ navigation }) {
  const [activeSlide, setActiveSlide] = useState(0);

  const onLiveTracking = () => navigation.navigate("PassengerLiveTracking");
  const onExploreRoutes = () => navigation.navigate("PassengerTripPlanner");
  const onLogin = () => navigation.navigate("LoginPage");

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <VayyCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.copy}>
              <Text style={styles.brand}>
                Vay<Text style={styles.brandAccent}>y</Text>
              </Text>
              <Text style={styles.headline}>Stop waiting. Start moving.</Text>
              <Text style={styles.description}>
                Real-time bus tracking, route discovery, and journey updates for smarter city commutes.
              </Text>
            </View>

            <View style={styles.cityArt}>
              <View style={styles.sun} />
              <View style={styles.skylineRow}>
                <View style={[styles.tower, styles.towerTall]} />
                <View style={styles.tower} />
                <View style={[styles.tower, styles.towerMid]} />
              </View>
              <View style={styles.bus}>
                <View style={styles.busWindow} />
                <View style={styles.busWindow} />
              </View>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <VayyButton fullWidth label="Live Tracking ->" onPress={onLiveTracking} />
            <TouchableOpacity onPress={onExploreRoutes} style={styles.outlineButton}>
              <Text style={styles.outlineText}>Explore Routes</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trustRow}>
            <Text style={styles.trustLive}>Live updates</Text>
            <Text style={styles.trustText}>Reliable</Text>
            <Text style={styles.trustText}>Always on time</Text>
          </View>
        </VayyCard>

        <View style={styles.dots}>
          {[0, 1, 2, 3].map((dot) => (
            <TouchableOpacity
              key={dot}
              onPress={() => setActiveSlide(dot)}
              style={[styles.dot, activeSlide === dot && styles.activeDot]}
            />
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featureScroller}>
          {features.map((feature) => (
            <VayyCard key={feature.title} style={styles.featureCard}>
              <View style={styles.featureIcon} />
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureCopy}>{feature.copy}</Text>
            </VayyCard>
          ))}
        </ScrollView>

        <TouchableOpacity onPress={onLogin} style={styles.loginLink}>
          <Text style={styles.loginText}>Switch account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.base,
    paddingBottom: SPACING.xxl,
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  heroTop: {
    gap: SPACING.xl,
  },
  copy: {
    gap: SPACING.md,
  },
  brand: {
    color: COLORS.black,
    fontSize: 54,
    fontWeight: "900",
  },
  brandAccent: {
    color: COLORS.primary,
  },
  headline: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
  },
  description: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 23,
  },
  cityArt: {
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.xl,
    height: 210,
    justifyContent: "flex-end",
    overflow: "hidden",
    padding: SPACING.lg,
  },
  sun: {
    backgroundColor: COLORS.liveAccent,
    borderRadius: RADIUS.full,
    height: 46,
    position: "absolute",
    right: 30,
    top: 28,
    width: 46,
  },
  skylineRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.base,
  },
  tower: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    height: 72,
    opacity: 0.8,
    width: 44,
  },
  towerTall: {
    height: 112,
  },
  towerMid: {
    height: 92,
  },
  bus: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    gap: SPACING.sm,
    height: 58,
    padding: SPACING.md,
  },
  busWindow: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    flex: 1,
  },
  buttonRow: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  outlineButton: {
    alignItems: "center",
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
  },
  outlineText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  trustLive: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  trustText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
    marginVertical: SPACING.lg,
  },
  dot: {
    backgroundColor: COLORS.borderMedium,
    borderRadius: RADIUS.full,
    height: 8,
    width: 8,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
    width: 28,
  },
  featureScroller: {
    marginHorizontal: -SPACING.base,
    paddingHorizontal: SPACING.base,
  },
  featureCard: {
    marginRight: SPACING.md,
    minHeight: 150,
    width: 190,
  },
  featureIcon: {
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.full,
    height: 42,
    marginBottom: SPACING.base,
    width: 42,
  },
  featureTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  featureCopy: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.sm,
  },
  loginLink: {
    alignSelf: "center",
    marginTop: SPACING.xl,
  },
  loginText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },
});
