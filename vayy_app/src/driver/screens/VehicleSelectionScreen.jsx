import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";

export default function VehicleSelectionScreen({ navigation }) {
  const vehicles = [
    { id: "bike", label: "Bike", icon: "bicycle", color: "#009849" },
    { id: "auto", label: "Auto", icon: "car", color: "#BA7517" },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#009849" />
      <ScreenHeader
        title="Select Vehicle"
        subtitle="Choose the vehicle you'll be driving today"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.container}>
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
  grid: { gap: 16 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 24, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  iconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cardLabel: { fontSize: 18, fontWeight: "800", color: COLORS.text },
});
