import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";

export default function VehicleSelectionScreen({ navigation }) {
  const vehicles = [
    { id: "bike", label: "Bike", icon: "bicycle", color: "#009849" },
    { id: "auto", label: "Auto", icon: "car", color: "#BA7517" },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Select Vehicle</Text>
        <Text style={styles.subtitle}>Choose the vehicle you'll be driving today</Text>
        <View style={styles.grid}>
          {vehicles.map((v) => (
            <TouchableOpacity key={v.id} style={styles.card} activeOpacity={0.8}>
              <View style={[styles.iconWrap, { backgroundColor: v.color + "15" }]}>
                <Ionicons name={v.icon} size={36} color={v.color} />
              </View>
              <Text style={styles.cardLabel}>{v.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  title: { fontSize: 24, fontWeight: "900", color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, fontWeight: "500", marginBottom: 32 },
  grid: { gap: 16 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 24, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  iconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cardLabel: { fontSize: 18, fontWeight: "800", color: COLORS.text },
});
