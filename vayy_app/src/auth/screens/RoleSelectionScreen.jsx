import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, User, Navigation } from "lucide-react-native";
import COLORS from "../../shared/constants/colors";
import { useDispatch } from "react-redux";
import { setField } from "../../store/slices/onboardingSlice";

const ROLES = [
  {
    key: "passenger",
    title: "Buddy",
    subtitle: "I want to find rides.",
    icon: (active) => <User size={36} color={active ? COLORS.primary : "#9ca3af"} />,
  },
  {
    key: "driver",
    title: "Marshal",
    subtitle: "I want to drive and earn.",
    icon: (active) => <Navigation size={36} color={active ? COLORS.primary : "#9ca3af"} />,
  },
];

export default function RoleSelectionScreen({ navigation }) {
  const dispatch = useDispatch();
  const [selected, setSelected] = useState(null);

  const ctaLabel = selected
    ? `Continue as ${selected === "passenger" ? "Buddy" : "Marshal"}`
    : "Select your role";

  const handleContinue = () => {
    if (!selected) return;
    navigation.navigate("EmailVerification", { role: selected });
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <ArrowLeft size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.hero}>How will you use OMV?</Text>
        <Text style={styles.sub}>Choose your role to get started</Text>
        <View style={styles.cardStack}>
          {ROLES.map((role) => {
            const active = selected === role.key;
            return (
              <TouchableOpacity
                key={role.key}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => {
                  dispatch(setField({ field: "role", value: role.key }));
                  setSelected(role.key);
                }}
                activeOpacity={0.85}
              >
                {active && <View style={styles.badge}><Text style={styles.badgeText}>✓</Text></View>}
                <View style={styles.iconWrap}>{role.icon(active)}</View>
                <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{role.title}</Text>
                <Text style={styles.cardSub}>{role.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, !selected && styles.ctaDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={!selected}
        >
          <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: 16, marginTop: Platform.OS === "android" ? 8 : 0 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  hero: { fontSize: 28, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 15, color: COLORS.textMuted, marginBottom: 32 },
  cardStack: { gap: 16 },
  card: {
    borderRadius: 18, borderWidth: 1.5, borderColor: "#e5e7eb", padding: 24,
    backgroundColor: "#fff", minHeight: 130, justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardActive: {
    borderColor: COLORS.primary, borderWidth: 2,
    shadowColor: COLORS.primary, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  badge: {
    position: "absolute", top: 12, right: 12, width: 24, height: 24,
    borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  iconWrap: { marginBottom: 12 },
  cardTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, marginBottom: 4 },
  cardTitleActive: { color: COLORS.primary },
  cardSub: { fontSize: 14, color: COLORS.textMuted },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === "android" ? 24 : 16 },
  cta: { backgroundColor: COLORS.primary, borderRadius: 18, height: 56, alignItems: "center", justifyContent: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  ctaDisabled: { backgroundColor: "#d1d5db", shadowOpacity: 0, elevation: 0 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ctaTextDisabled: { color: "#9ca3af" },
});
