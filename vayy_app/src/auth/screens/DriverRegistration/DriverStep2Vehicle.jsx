import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Bike } from "lucide-react-native";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import BottomStickyButton from "../../components/BottomStickyButton";
import { useSelector, useDispatch } from "react-redux";
import { setField } from "../../../store/slices/onboardingSlice";

const VEHICLES = [
  {
    key: "bike",
    title: "Motorcycle",
    subtitle: "Quick rides with ride buddies",
    icon: (active) => (
      <View style={[styles.vIcon, active && styles.vIconActive]}>
        <Bike size={32} color={active ? "#fff" : COLORS.textMuted} />
      </View>
    ),
  },
  {
    key: "auto",
    title: "Auto",
    subtitle: "Shared auto rides",
    icon: (active) => (
      <View style={[styles.vIcon, active && styles.vIconActive]}>
        <Bike size={32} color={active ? "#fff" : COLORS.textMuted} />
      </View>
    ),
  },
];

export default function DriverStep2Vehicle({ onNext, onBack, loading, error }) {
  const dispatch = useDispatch();
  const fields = useSelector((state) => state.onboarding.fields);
  const selected = fields.vehicleType || "bike";

  return (
    <SafeAreaView style={styles.root}>
      <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Vehicle</Text>
        <Text style={styles.sub}>Select how you want to drive with OMV</Text>
      </View>
        <ProgressBar current={3} total={7} />
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <View style={styles.body}>
        {VEHICLES.map((v) => {
          const active = selected === v.key;
          return (
            <TouchableOpacity key={v.key} style={[styles.card, active && styles.cardActive]} onPress={() => {
              dispatch(setField({ field: "vehicleType", value: v.key }));
            }} activeOpacity={0.85}>
              {active && <View style={styles.badge}><Text style={styles.badgeText}>✓</Text></View>}
              {v.icon(active)}
              <Text style={[styles.cardTitle, active && { color: COLORS.primary }]}>{v.title}</Text>
              <Text style={styles.cardSub}>{v.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <BottomStickyButton label={`Continue with ${selected === "auto" ? "Auto" : "Bike"}`} onPress={() => selected && onNext({ vehicleType: selected })} disabled={!selected} loading={loading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: 16 },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2, marginBottom: 4 },
  errorBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderRadius: 10, borderWidth: 1, padding: 12, marginHorizontal: 24, marginBottom: 12 },
  errorText: { color: "#ef4444", fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 16 },
  card: { borderRadius: 24, borderWidth: 1.5, borderColor: "#e5e7eb", padding: 28, backgroundColor: "#fff", alignItems: "center", minHeight: 170, justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardActive: { borderColor: COLORS.primary, borderWidth: 2, shadowColor: COLORS.primary, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  badge: { position: "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  vIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f0faf2", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  vIconActive: { backgroundColor: COLORS.primary },
  cardTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, marginBottom: 4 },
  cardSub: { fontSize: 14, color: COLORS.textMuted },
});
