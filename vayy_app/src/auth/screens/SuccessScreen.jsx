import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../shared/constants/colors";

export default function SuccessScreen({ title, message, cta, onCta }) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <View style={styles.graphic}>
          <View style={styles.outerCircle}>
            <View style={styles.innerCircle}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
          </View>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity style={styles.cta} onPress={onCta} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{cta}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  body: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  graphic: { marginBottom: 24 },
  outerCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(0,152,73,0.1)", alignItems: "center", justifyContent: "center" },
  innerCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#f0faf2", alignItems: "center", justifyContent: "center" },
  checkMark: { fontSize: 32, color: COLORS.primary, fontWeight: "800" },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, marginBottom: 8, textAlign: "center" },
  message: { fontSize: 15, color: COLORS.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 32 },
  cta: { backgroundColor: COLORS.primary, borderRadius: 18, height: 54, paddingHorizontal: 40, alignItems: "center", justifyContent: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
