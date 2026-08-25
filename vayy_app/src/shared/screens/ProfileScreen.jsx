import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { logout as logoutUser } from "../../auth/authSlice";
import { fetchProfile } from "../../store/slices/profileSlice";

import COLORS from "../constants/colors";
import { DRIVER_ROLES } from "../../constants";

const INITIALS_COLORS = ["#009849", "#2563EB", "#F59E0B", "#EF4444", "#8B5CF6"];

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name) {
  let hash = 0;
  if (!name) return INITIALS_COLORS[0];
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state) => state.auth);
  const { data: profile } = useSelector((state) => state.profile);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  const isDriver = DRIVER_ROLES.includes(user?.role);
  const displayName = profile?.display_name || user?.full_name || user?.name || "User Name";
  const displayEmail = user?.email || "No email";
  const phoneNumber = profile?.phone_number || "--";
  const licenseNumber = profile?.license_number;
  const vehicleNumber = profile?.vehicle_number;
  const vehicleType = profile?.vehicle_type;
  const rating = profile?.rating;
  const totalTrips = profile?.total_trips || 0;
  const cityName = profile?.city_name || user?.city?.name || user?.city || null;
  const avatarColor = getAvatarColor(displayName);
  const initials = getInitials(displayName);
  const roleLabel = isDriver ? "MARSHAL" : user?.role?.toUpperCase() || "PASSENGER";

  const headerStats = [
    { label: "Trips", value: String(totalTrips) },
    { label: "Rating", value: rating ? rating.toFixed(1) : "—" },
    {
      label: isDriver ? "Vehicle" : "City",
      value: isDriver
        ? vehicleType ? vehicleType.toUpperCase() : "—"
        : cityName?.split(",")?.[0] || "—",
    },
  ];

  const stats = [
    { icon: "calendar-outline", label: "Trips", value: String(totalTrips) },
    { icon: "star", label: "Rating", value: rating ? rating.toFixed(1) : "—" },
    ...(isDriver
      ? [{ icon: "speedometer-outline", label: "Vehicle", value: vehicleType ? vehicleType.toUpperCase() : "—" }]
      : [{ icon: "location-outline", label: "City", value: cityName?.split(",")?.[0] || "—" }]),
    { icon: "call-outline", label: "Phone", value: phoneNumber },
  ];

  const detailItems = [
    { icon: "person-outline", label: "Full Name", value: displayName },
    { icon: "mail-outline", label: "Email", value: displayEmail },
    { icon: "call-outline", label: "Phone", value: phoneNumber },
    ...(isDriver
      ? [
          { icon: "card-outline", label: "License", value: licenseNumber || "—" },
          { icon: "speedometer-outline", label: "Vehicle", value: vehicleNumber || vehicleType || "—" },
        ]
      : [{ icon: "location-outline", label: "City", value: cityName || "—" }]),
  ];

  const settings = [
    { icon: "notifications-outline", label: "Notifications", value: "Enabled" },
    { icon: "language-outline", label: "Language", value: "English" },
    { icon: "create-outline", label: "Edit Profile", screen: "EditProfile" },
    { icon: "shield-checkmark-outline", label: "Privacy Policy", value: "View", screen: "PrivacyPolicy" },
    { icon: "help-circle-outline", label: "Help & Support", screen: "HelpSupport" },
    { icon: "information-circle-outline", label: "About", value: "v1.0.0" },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ── VAYY Green Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerGradient}>
            <View style={styles.gradBase} />
            <View style={styles.gradRay1} />
            <View style={styles.gradRay2} />
          </View>

          <View style={styles.headerTop}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.onlineDot} />
            </View>
            <Text style={styles.headerName}>{displayName}</Text>
            <Text style={styles.headerEmail}>{displayEmail}</Text>
            <View style={styles.roleBadge}>
              <MaterialIcons name={isDriver ? "directions-car" : "person"} size={12} color="#FFFFFF" />
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.headerStatsRow}>
            {headerStats.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={styles.headerStatDiv} />}
                <View style={styles.headerStat}>
                  <Text style={styles.headerStatValue}>{s.value}</Text>
                  <Text style={styles.headerStatLabel}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Stats Grid ── */}
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statBox}>
              <View style={styles.statIconWrap}>
                <Ionicons name={s.icon} size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Profile Details ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
          <View style={styles.card}>
            {detailItems.map((item, i) => (
              <View key={i}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <Ionicons name={item.icon} size={16} color={COLORS.textLight} />
                    <Text style={styles.detailLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.detailValue} numberOfLines={1}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Settings ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.card}>
            {settings.map((item, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.6}
                onPress={item.screen ? () => navigation.navigate(item.screen) : undefined}
              >
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name={item.icon} size={18} color={COLORS.textLight} />
                    <Text style={styles.settingLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.settingRight}>
                    {item.value ? <Text style={styles.settingValue}>{item.value}</Text> : null}
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Logout ── */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Vayy App v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* ── Header ── */
  header: {
    position: "relative",
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradBase: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#009849",
  },
  gradRay1: {
    position: "absolute",
    top: -60,
    right: -40,
    width: "70%",
    height: "90%",
    backgroundColor: "#00B857",
    opacity: 0.25,
    borderRadius: 120,
    transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute",
    top: -80,
    right: -20,
    width: "50%",
    height: "70%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100,
    transform: [{ rotate: "35deg" }],
  },
  headerTop: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#00E676",
    borderWidth: 3,
    borderColor: "#009849",
  },
  headerName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  headerEmail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    marginBottom: 10,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  roleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
  },
  headerStat: {
    flex: 1,
    alignItems: "center",
  },
  headerStatValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  headerStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },
  headerStatDiv: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  /* ── Stats Grid ── */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginTop: -16,
    zIndex: 5,
    gap: 8,
  },
  statBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* ── Sections ── */
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 28,
  },

  /* ── Detail Rows ── */
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "800",
    maxWidth: "50%",
    textAlign: "right",
  },

  /* ── Settings ── */
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "700",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingValue: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: "600",
  },

  /* ── Logout ── */
  logoutSection: {
    paddingHorizontal: 16,
    marginTop: 32,
    alignItems: "center",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#EF4444",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 20,
  },
});
