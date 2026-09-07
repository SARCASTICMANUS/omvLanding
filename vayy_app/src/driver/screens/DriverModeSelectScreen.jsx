import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";

const bikeImg = require("../../../assets/vayyBike.webp");
const autoImg = require("../../../assets/vayyAuto.webp");

export default function DriverModeSelectScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Drive with</Text>
        <Text style={styles.brand}>VAYY</Text>
        <Text style={styles.subtitle}>Select your vehicle to get started</Text>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("DriverBikeHome")}
        >
          <Image source={bikeImg} style={styles.cardImage} resizeMode="contain" />
          <Text style={styles.cardLabel}>Bike</Text>
          <Text style={styles.cardDesc}>Quick rides on two wheels</Text>
          <View style={[styles.actionChip, { backgroundColor: COLORS.primary + "10" }]}>
            <Text style={[styles.actionText, { color: COLORS.primary }]}>Start</Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("DriverAutoHome")}
        >
          <Image source={autoImg} style={styles.cardImage} resizeMode="contain" />
          <Text style={styles.cardLabel}>Auto</Text>
          <Text style={styles.cardDesc}>Share rides in your auto</Text>
          <View style={[styles.actionChip, { backgroundColor: "#BA7517" + "10" }]}>
            <Text style={[styles.actionText, { color: "#BA7517" }]}>Start</Text>
            <Ionicons name="arrow-forward" size={14} color="#BA7517" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>Select a vehicle to begin accepting rides</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAF9",
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  brand: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  grid: {
    gap: 16,
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardImage: {
    width: 120,
    height: 90,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9CA3AF",
    marginBottom: 16,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 20,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
});
