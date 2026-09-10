import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Bell } from "lucide-react-native";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import BottomStickyButton from "../../components/BottomStickyButton";

export default function PassengerStep2Permissions({ onNext, onBack }) {
  const [location, setLocation] = useState(false);
  const [notifications, setNotifications] = useState(false);

  return (
    <SafeAreaView style={styles.root}>
      <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Permissions</Text>
        <Text style={styles.sub}>Enable these to get the best experience</Text>
      </View>
      <ProgressBar current={2} total={3} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardLeft}>
            <View style={[styles.iconWrap, { backgroundColor: "#f0faf2" }]}>
              <MapPin size={22} color={COLORS.primary} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Enable Location</Text>
              <Text style={styles.cardSub}>OMV uses location to find rides near you.</Text>
            </View>
          </View>
          <Switch value={location} onValueChange={setLocation} trackColor={{ false: "#e5e7eb", true: COLORS.primary }} thumbColor="#fff" />
        </View>
        <View style={styles.card}>
          <View style={styles.cardLeft}>
            <View style={[styles.iconWrap, { backgroundColor: "#f0faf2" }]}>
              <Bell size={22} color={COLORS.primary} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Notifications</Text>
              <Text style={styles.cardSub}>Get notified when your ride arrives.</Text>
            </View>
          </View>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: "#e5e7eb", true: COLORS.primary }} thumbColor="#fff" />
        </View>
        <Text style={styles.note}>You can change these anytime in Settings.</Text>
        <View style={{ height: 80 }} />
      </ScrollView>
      <BottomStickyButton label="Continue" onPress={() => onNext({ location, notifications })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: 16 },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2, marginBottom: 4 },
  scroll: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { paddingBottom: 100, paddingTop: 8 },
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e5e7eb", padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 14 },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  cardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  note: { fontSize: 12, color: COLORS.textLight, textAlign: "center", marginTop: 8 },
});
