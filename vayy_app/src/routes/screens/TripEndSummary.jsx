import React from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import VayyCard from "../../shared/components/common/VayyCard";
import VayyButton from "../../shared/components/common/VayyButton";
import BusIconBadge from "../../shared/components/common/BusIconBadge";
import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import RADIUS from "../../shared/constants/radius";
import SHADOW from "../../shared/constants/shadow";

export default function TripEndSummary({ navigation, route }) {
  const { summary = {}, stats = {} } = route.params || {};

  const handleFinish = () => {
    navigation.navigate("DriverHome");
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.successIcon}>
             <Text style={styles.check}>✓</Text>
          </View>
          <Text style={styles.title}>Trip Completed!</Text>
          <Text style={styles.subtitle}>You've successfully finished your route.</Text>
        </View>

        <VayyCard style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>TOTAL EARNINGS</Text>
          <Text style={styles.earningsValue}>₹{stats.earnings || "450.00"}</Text>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsRow}>
             <View style={styles.earningsStat}>
                <Text style={styles.statLabel}>DISTANCE</Text>
                <Text style={styles.statValue}>{stats.distance || "12.4"} km</Text>
             </View>
             <View style={styles.earningsStat}>
                <Text style={styles.statLabel}>DURATION</Text>
                <Text style={styles.statValue}>{stats.duration || "45"} min</Text>
             </View>
          </View>
        </VayyCard>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.statsGrid}>
             <View style={styles.miniCard}>
                <Text style={styles.miniValue}>{stats.passengers || "24"}</Text>
                <Text style={styles.miniLabel}>Passengers</Text>
             </View>
             <View style={styles.miniCard}>
                <Text style={styles.miniValue}>{stats.stops || "12"}</Text>
                <Text style={styles.miniLabel}>Stops Hit</Text>
             </View>
             <View style={styles.miniCard}>
                <Text style={styles.miniValue}>{stats.rating || "4.9"}</Text>
                <Text style={styles.miniLabel}>Avg Rating</Text>
             </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>High Density Zones</Text>
          <Text style={styles.sectionSubtitle}>Areas with highest passenger demand today</Text>
          <VayyCard style={styles.heatmapCard}>
             <View style={styles.heatmapPlaceholder}>
                <Text style={styles.heatmapIcon}>📍</Text>
                <Text style={styles.heatmapText}>City Center & Metro Gate 2</Text>
             </View>
          </VayyCard>
        </View>

        <VayyButton 
          fullWidth 
          label="Back to Dashboard" 
          onPress={handleFinish} 
          size="lg"
          style={styles.finishBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  header: {
    alignItems: "center",
    marginTop: SPACING.md,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    ...SHADOW.md,
  },
  check: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: "900",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  earningsCard: {
    backgroundColor: COLORS.primary,
    padding: SPACING.xl,
    alignItems: "center",
  },
  earningsLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  earningsValue: {
    color: COLORS.white,
    fontSize: 48,
    fontWeight: "900",
    marginVertical: 8,
  },
  earningsDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 16,
  },
  earningsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
  },
  earningsStat: {
    alignItems: "center",
  },
  statLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "800",
  },
  statValue: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
  section: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -8,
  },
  statsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  miniCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    ...SHADOW.sm,
  },
  miniValue: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },
  miniLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
  heatmapCard: {
    padding: SPACING.lg,
    backgroundColor: "#F0F7F4",
  },
  heatmapPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  heatmapIcon: {
    fontSize: 24,
  },
  heatmapText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.success,
  },
  finishBtn: {
    marginTop: SPACING.md,
  },
});
