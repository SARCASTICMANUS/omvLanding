import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";
import { FAQS, SUPPORT_INFO } from "../../data/landingPageData";

export default function HelpSupportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [expandedIndex, setExpandedIndex] = React.useState(null);

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
          <Text style={styles.headerTitle}>Help & Support</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.contactCard}>
          <View style={styles.contactRow}>
            <View style={styles.contactIconWrap}>
              <Ionicons name="mail-outline" size={20} color="#009849" />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>{SUPPORT_INFO.email}</Text>
            </View>
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_INFO.email}`)}>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.contactDivider} />
          <View style={styles.contactRow}>
            <View style={styles.contactIconWrap}>
              <Ionicons name="call-outline" size={20} color="#009849" />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>{SUPPORT_INFO.phone}</Text>
            </View>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${SUPPORT_INFO.phone}`)}>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.contactDivider} />
          <View style={styles.contactRow}>
            <View style={styles.contactIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#009849" />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactLabel}>Live Chat</Text>
              <Text style={styles.contactValue}>{SUPPORT_INFO.liveChat}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.faqTitle}>Frequently Asked Questions</Text>

        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            style={[styles.faqCard, expandedIndex === i && styles.faqCardExpanded]}
            onPress={() => setExpandedIndex(expandedIndex === i ? null : i)}
          >
            <View style={styles.faqRow}>
              <Text style={styles.faqQuestion}>{faq.q}</Text>
              <Ionicons
                name={expandedIndex === i ? "chevron-up" : "chevron-down"}
                size={18}
                color={COLORS.textMuted}
              />
            </View>
            {expandedIndex === i && (
              <Text style={styles.faqAnswer}>{faq.a}</Text>
            )}
          </TouchableOpacity>
        ))}

        <Text style={styles.responseTime}>{SUPPORT_INFO.responseTime}</Text>
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
    padding: 20,
    paddingBottom: 40,
  },
  contactCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
  },
  contactTextWrap: { flex: 1 },
  contactLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 1,
  },
  contactDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 58,
  },
  faqTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 14,
  },
  faqCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  faqCardExpanded: {
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  faqRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: 12,
  },
  responseTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 20,
  },
});
