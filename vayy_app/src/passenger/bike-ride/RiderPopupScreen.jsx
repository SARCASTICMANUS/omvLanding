import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import AppFrame from "../../components/AppFrame";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

// ─── Dummy data (matches design) ─────────────────────────────────────────────
const DRIVER = {
  name: "Priya Sharma",
  rating: 4.9,
  badge: "VAYY Partner",
  vehicle: "Auto",
  arrivingIn: "6 min",
  distanceAway: "2.1 km",
  otp: ["2", "7", "4", "1"],
  photo: null, // swap with require(...) when real asset available
};

const ACCENT = colors.primary ?? "#1D9E75"; // teal — matches design green

// ─── Sub-components ───────────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <View style={styles.mapContainer}>
      {/* Pickup chip */}
      <View style={[styles.mapChip, styles.mapChipTop]}>
        <Text style={styles.mapChipLabel}>Pickup</Text>
        <Text style={styles.mapChipValue}>Hazratganj Metro{"\n"}Gate 2</Text>
      </View>

      {/* Distance chip */}
      <View style={[styles.mapChip, styles.mapChipMid]}>
        <Text style={[styles.mapChipValue, { color: ACCENT }]}>2.1 km away</Text>
      </View>

      {/* Stop chip */}
      <View style={[styles.mapChip, styles.mapChipBot]}>
        <Text style={[styles.mapChipLabel, { color: ACCENT }]}>Your Stop</Text>
        <Text style={styles.mapChipValue}>Alambagh Bus{"\n"}Terminal</Text>
      </View>

      {/* Recenter button */}
      <View style={styles.recenterBtn}>
        <Text style={styles.recenterIcon}>◎</Text>
      </View>

      {/* Map label (placeholder background text) */}
      <Text style={styles.mapBgText}>MAP</Text>
    </View>
  );
}

function DriverAvatar({ photo, name }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.avatarWrap}>
      {photo ? (
        <Image source={photo} style={styles.avatarImg} />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: ACCENT + "22" }]}>
          <Text style={[styles.avatarInitials, { color: ACCENT }]}>{initials}</Text>
        </View>
      )}
    </View>
  );
}

function StatsGrid({ driver }) {
  const stats = [
    { icon: "🕐", label: "Arriving in", value: driver.arrivingIn },
    { icon: "🛵", label: "Distance away", value: driver.distanceAway },
    { icon: "🚗", label: "Vehicle", value: driver.vehicle },
    { icon: "📍", label: "Live location", value: "Track on map", isLink: true },
  ];

  return (
    <View style={styles.statsGrid}>
      {stats.map((s, i) => (
        <View
          key={i}
          style={[
            styles.statCell,
            i % 2 === 0 && i < stats.length - 1 && styles.statCellBorderRight,
            i < 2 && styles.statCellBorderBottom,
          ]}
        >
          <Text style={styles.statIcon}>{s.icon}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
          <Text style={[styles.statValue, s.isLink && { color: ACCENT }]}>
            {s.value}
            {s.isLink && <Text style={{ color: ACCENT }}> ›</Text>}
          </Text>
        </View>
      ))}
    </View>
  );
}

function OTPRow({ otp }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.otpSection}>
      <View style={styles.otpHeader}>
        <View style={[styles.otpIconCircle, { backgroundColor: ACCENT + "18" }]}>
          <Text style={styles.otpIconEmoji}>🤝</Text>
        </View>
        <View style={styles.otpHeaderText}>
          <Text style={styles.otpTitle}>Handshake OTP</Text>
          <Text style={styles.otpSubtitle}>Share this OTP with driver</Text>
        </View>
        <View style={styles.otpDigitsRow}>
          {otp.map((digit, i) => (
            <View key={i} style={[styles.otpBox, { borderColor: ACCENT + "44" }]}>
              <Text style={[styles.otpDigit, { color: ACCENT }]}>{digit}</Text>
            </View>
          ))}
          <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
            <Text style={[styles.copyText, { color: ACCENT }]}>
              {copied ? "✓ Copied" : "⎘ Copy"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Safety note */}
      <View style={[styles.safetyBanner, { backgroundColor: ACCENT + "12", borderColor: ACCENT + "30" }]}>
        <Text style={[styles.safetyText, { color: ACCENT }]}>
          ✓  For your safety, verify the OTP before boarding
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function RiderPopupScreen({ navigation }) {
  return (
    <AppFrame
      navigation={navigation}
      title="Ride request"
      accent={ACCENT}
      hideHeader
    >
      <View style={styles.root}>
        {/* Top: Map */}
        <MapPlaceholder />

        {/* Bottom: Sheet */}
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Sheet handle */}
          <View style={styles.sheetHandle} />

          {/* Accepted banner */}
          <View style={styles.acceptedBanner}>
            <View style={[styles.acceptedIcon, { backgroundColor: ACCENT + "18" }]}>
              <Text style={[styles.acceptedIconText, { color: ACCENT }]}>✓</Text>
            </View>
            <View style={styles.acceptedText}>
              <Text style={styles.acceptedTitle}>Ride Accepted!</Text>
              <Text style={styles.acceptedSub}>Your driver is on the way</Text>
            </View>
            <Text style={styles.acceptedTime}>15 sec ago</Text>
          </View>

          <View style={styles.divider} />

          {/* Driver row */}
          <View style={styles.driverRow}>
            <DriverAvatar photo={DRIVER.photo} name={DRIVER.name} />
            <View style={styles.driverInfo}>
              <View style={styles.driverNameRow}>
                <Text style={styles.driverName}>{DRIVER.name}</Text>
                <View style={[styles.verifiedBadge, { backgroundColor: ACCENT + "18" }]}>
                  <Text style={[styles.verifiedIcon, { color: ACCENT }]}>✓</Text>
                </View>
              </View>
              <View style={styles.driverMeta}>
                <Text style={styles.starIcon}>⭐</Text>
                <Text style={styles.ratingText}>{DRIVER.rating}</Text>
                <Text style={styles.metaDot}> • </Text>
                <Text style={styles.badgeText}>{DRIVER.badge}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.callBtn, { backgroundColor: ACCENT + "18" }]}>
              <Text style={[styles.callIcon, { color: ACCENT }]}>📞</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Stats 2×2 grid */}
          <StatsGrid driver={DRIVER} />

          <View style={styles.divider} />

          {/* OTP Section */}
          <OTPRow otp={DRIVER.otp} />

          {/* Cancel button */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </AppFrame>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E8F0E8",
  },

  // ── Map ──
  mapContainer: {
    flex: 1,
    backgroundColor: "#DDE8DD",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 300,
  },
  mapBgText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#C8D8C8",
    letterSpacing: 12,
  },
  mapChip: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: spacing.sm,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mapChipTop: { top: 20, right: 16 },
  mapChipMid: { top: "40%", right: 16 },
  mapChipBot: { bottom: 32, left: 16 },
  mapChipLabel: {
    ...typography.caption,
    color: ACCENT,
    fontWeight: "600",
    marginBottom: 2,
  },
  mapChipValue: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  recenterBtn: {
    position: "absolute",
    right: 16,
    bottom: 32,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recenterIcon: { fontSize: 18, color: "#555" },

  // ── Sheet ──
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "65%",
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    marginTop: 10,
    marginBottom: spacing.md,
  },

  // ── Accepted banner ──
  acceptedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  acceptedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptedIconText: { fontSize: 16, fontWeight: "700" },
  acceptedText: { flex: 1 },
  acceptedTitle: { ...typography.h4, color: "#1A1A1A" },
  acceptedSub: { ...typography.caption, color: "#888" },
  acceptedTime: { ...typography.caption, color: "#AAA" },

  divider: {
    height: 0.5,
    backgroundColor: "#EBEBEB",
    marginVertical: spacing.md,
  },

  // ── Driver row ──
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#F0F0F0",
  },
  avatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
  avatarFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: { fontSize: 22, fontWeight: "700" },
  driverInfo: { flex: 1 },
  driverNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  driverName: { ...typography.h3, color: "#1A1A1A" },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedIcon: { fontSize: 10, fontWeight: "700" },
  driverMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  starIcon: { fontSize: 13 },
  ratingText: { ...typography.bodySmall, fontWeight: "700", color: "#1A1A1A", marginLeft: 2 },
  metaDot: { color: "#CCC", marginHorizontal: 2 },
  badgeText: { ...typography.bodySmall, color: "#888" },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  callIcon: { fontSize: 18 },

  // ── Stats grid ──
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 0.5,
    borderColor: "#EBEBEB",
    borderRadius: 12,
    overflow: "hidden",
  },
  statCell: {
    width: "50%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "flex-start",
  },
  statCellBorderRight: {
    borderRightWidth: 0.5,
    borderRightColor: "#EBEBEB",
  },
  statCellBorderBottom: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#EBEBEB",
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statLabel: { ...typography.caption, color: "#888", marginBottom: 2 },
  statValue: { ...typography.h4, color: "#1A1A1A" },

  // ── OTP ──
  otpSection: { gap: spacing.sm },
  otpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  otpIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  otpIconEmoji: { fontSize: 20 },
  otpHeaderText: { flex: 1 },
  otpTitle: { ...typography.body, fontWeight: "600", color: "#1A1A1A" },
  otpSubtitle: { ...typography.caption, color: "#888" },
  otpDigitsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    width: "100%",
  },
  otpBox: {
    width: 40,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FFF8",
  },
  otpDigit: { fontSize: 22, fontWeight: "700" },
  copyBtn: { marginLeft: 6 },
  copyText: { ...typography.bodySmall, fontWeight: "600" },
  safetyBanner: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  safetyText: { ...typography.caption, fontWeight: "500", textAlign: "center" },

  // ── Cancel button ──
  cancelBtn: {
    marginTop: spacing.lg,
    borderWidth: 1.5,
    borderColor: "#E24B4A",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: {
    ...typography.body,
    fontWeight: "700",
    color: "#E24B4A",
  },
});