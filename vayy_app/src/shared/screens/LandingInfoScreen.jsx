import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";
import { PRIVACY_POLICY, FAQS, SUPPORT_INFO } from "../../data/landingPageData";

const CARDS = [
  {
    id: "privacy",
    icon: "shield-checkmark-outline",
    title: "Privacy Policy",
    subtitle: "How we collect, use & protect your data",
    color: "#009849",
    bgColor: "#ECFAF1",
  },
  {
    id: "faq",
    icon: "chatbubble-ellipses-outline",
    title: "FAQ",
    subtitle: "Frequently asked questions",
    color: "#2563EB",
    bgColor: "#EFF6FF",
  },
  {
    id: "support",
    icon: "headset-outline",
    title: "Help & Support",
    subtitle: "Contact us for assistance",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
  },
];

export default function LandingInfoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeCard, setActiveCard] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const renderHeader = () => (
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
        <Text style={styles.headerTitle}>
          {activeCard === "privacy"
            ? "Privacy Policy"
            : activeCard === "faq"
            ? "FAQ"
            : activeCard === "support"
            ? "Help & Support"
            : "Information"}
        </Text>
      </View>
    </View>
  );

  const renderCards = () => (
    <ScrollView contentContainerStyle={styles.cardsContainer}>
      {CARDS.map((card) => (
        <TouchableOpacity
          key={card.id}
          activeOpacity={0.7}
          style={styles.card}
          onPress={() => setActiveCard(card.id)}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: card.bgColor }]}>
            <Ionicons name={card.icon} size={28} color={card.color} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderPrivacyPolicy = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => setActiveCard(null)} style={styles.backLink}>
        <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
        <Text style={styles.backLinkText}>Back to menu</Text>
      </TouchableOpacity>

      <Text style={styles.lastUpdated}>Last updated: {PRIVACY_POLICY.lastUpdated}</Text>
      <Text style={styles.paragraph}>{PRIVACY_POLICY.intro}</Text>

      {PRIVACY_POLICY.sections.map((section, i) => (
        <View key={i}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.paragraphs.map((p, j) => (
            <Text key={j} style={styles.paragraph}>{p}</Text>
          ))}
          {section.bullets &&
            section.bullets.map((b, j) => (
              <Text key={j} style={styles.bullet}>• {b}</Text>
            ))}
        </View>
      ))}
    </ScrollView>
  );

  const renderFaq = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => setActiveCard(null)} style={styles.backLink}>
        <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
        <Text style={styles.backLinkText}>Back to menu</Text>
      </TouchableOpacity>

      {FAQS.map((faq, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={0.7}
          style={[styles.faqCard, expandedFaq === i && styles.faqCardExpanded]}
          onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
        >
          <View style={styles.faqRow}>
            <Text style={styles.faqQuestion}>{faq.q}</Text>
            <Ionicons
              name={expandedFaq === i ? "chevron-up" : "chevron-down"}
              size={18}
              color={COLORS.textMuted}
            />
          </View>
          {expandedFaq === i && <Text style={styles.faqAnswer}>{faq.a}</Text>}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSupport = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => setActiveCard(null)} style={styles.backLink}>
        <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
        <Text style={styles.backLinkText}>Back to menu</Text>
      </TouchableOpacity>

      <View style={styles.contactCard}>
        <View style={styles.contactRow}>
          <View style={[styles.contactIconWrap, { backgroundColor: "#ECFAF1" }]}>
            <Ionicons name="mail-outline" size={20} color="#009849" />
          </View>
          <View style={styles.contactTextWrap}>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactValue}>{SUPPORT_INFO.email}</Text>
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${SUPPORT_INFO.email}`)}
          >
            <Ionicons name="open-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.contactDivider} />
        <View style={styles.contactRow}>
          <View style={[styles.contactIconWrap, { backgroundColor: "#EFF6FF" }]}>
            <Ionicons name="call-outline" size={20} color="#2563EB" />
          </View>
          <View style={styles.contactTextWrap}>
            <Text style={styles.contactLabel}>Phone</Text>
            <Text style={styles.contactValue}>{SUPPORT_INFO.phone}</Text>
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${SUPPORT_INFO.phone}`)}
          >
            <Ionicons name="open-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.contactDivider} />
        <View style={styles.contactRow}>
          <View style={[styles.contactIconWrap, { backgroundColor: "#FFFBEB" }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#F59E0B" />
          </View>
          <View style={styles.contactTextWrap}>
            <Text style={styles.contactLabel}>Live Chat</Text>
            <Text style={styles.contactValue}>{SUPPORT_INFO.liveChat}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.responseTime}>{SUPPORT_INFO.responseTime}</Text>
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={activeCard ? "#009849" : "transparent"}
        translucent={!activeCard}
      />
      {renderHeader()}
      {!activeCard && renderCards()}
      {activeCard === "privacy" && renderPrivacyPolicy()}
      {activeCard === "faq" && renderFaq()}
      {activeCard === "support" && renderSupport()}
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

  /* ── Cards ── */
  cardsContainer: {
    padding: 20,
    gap: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTextWrap: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  /* ── Content ── */
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
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

  /* ── FAQ ── */
  faqCard: {
    backgroundColor: COLORS.card,
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

  /* ── Support ── */
  contactCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
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
  responseTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 20,
  },
});
