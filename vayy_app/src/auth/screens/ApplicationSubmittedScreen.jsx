import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../shared/constants/colors";

export default function ApplicationSubmittedScreen({ onCta }) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Registration Submitted!</Text>
          <Text style={styles.message}>
            {"We're reviewing your documents and KYC."}{'\n'}
            {"This usually takes 24-48 hours."}{'\n'}
            {"We'll notify you once you're approved."}
          </Text>
          <View style={styles.estimateBox}>
            <Text style={styles.estimateLabel}>Estimated verification time</Text>
            <Text style={styles.estimateValue}>24 - 48 hours</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.cta} onPress={onCta} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Go to Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },
  body: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 32, alignItems: "center", width: "100%", maxWidth: 340, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10, marginBottom: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text, textAlign: "center", marginBottom: 12 },
  message: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  estimateBox: { backgroundColor: "#f0faf2", borderRadius: 14, padding: 16, alignItems: "center", width: "100%" },
  estimateLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  estimateValue: { fontSize: 16, fontWeight: "800", color: COLORS.primary },
  cta: { backgroundColor: "#fff", borderRadius: 18, height: 54, paddingHorizontal: 40, alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.primary, fontSize: 16, fontWeight: "700" },
});
