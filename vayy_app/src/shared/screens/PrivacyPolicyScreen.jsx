import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";

export default function PrivacyPolicyScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#009849" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerGradient}>
          <View style={styles.gradBase} />
          <View style={styles.gradRay1} />
          <View style={styles.gradRay2} />
        </View>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: July 2026</Text>

        <Text style={styles.paragraph}>
          VAYY (“we,” “our,” or “us”) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We collect information that you provide directly to us, including your name, email address, phone number, and profile information when you create an account. We also collect location data, route preferences, and trip history to provide our ride-sharing and transit services.
        </Text>
        <Text style={styles.paragraph}>
          When you use our app, we automatically collect certain information, including device type, operating system, app usage data, and precise location data when the app is in use.
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the information we collect to:
        </Text>
        <Text style={styles.bullet}>• Match you with routes and Marshals</Text>
        <Text style={styles.bullet}>• Provide real-time tracking and navigation</Text>
        <Text style={styles.bullet}>• Process payments and trips</Text>
        <Text style={styles.bullet}>• Improve our services and user experience</Text>
        <Text style={styles.bullet}>• Communicate with you about your trips</Text>
        <Text style={styles.bullet}>• Ensure safety and security of our platform</Text>

        <Text style={styles.sectionTitle}>3. Data Sharing</Text>
        <Text style={styles.paragraph}>
          We may share your information with Marshals or passengers as necessary for trip coordination, with service providers who help us operate our platform, and as required by law. We do not sell your personal information to third parties.
        </Text>

        <Text style={styles.sectionTitle}>4. Data Security</Text>
        <Text style={styles.paragraph}>
          We implement industry-standard security measures to protect your data, including encryption in transit and at rest. However, no method of electronic storage is 100% secure, and we cannot guarantee absolute security.
        </Text>

        <Text style={styles.sectionTitle}>5. Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to access, update, or delete your personal information at any time through your account settings. You may also contact us to request a copy of your data or to close your account.
        </Text>

        <Text style={styles.sectionTitle}>6. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions about this Privacy Policy, please contact us at support@vayy.app or write to us at: VAYY Mobility Pvt. Ltd., Lucknow, Uttar Pradesh, India.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  headerGradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  gradBase: { ...StyleSheet.absoluteFill, backgroundColor: "#009849" },
  gradRay1: {
    position: "absolute", top: -60, right: -40,
    width: "70%", height: "90%",
    backgroundColor: "#00B857", opacity: 0.25,
    borderRadius: 120, transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute", top: -80, right: -20,
    width: "50%", height: "70%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100, transform: [{ rotate: "35deg" }],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    zIndex: 2,
    gap: 12,
  },
  backBtn: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
    lineHeight: 22,
    marginLeft: 8,
    marginBottom: 4,
  },
});
