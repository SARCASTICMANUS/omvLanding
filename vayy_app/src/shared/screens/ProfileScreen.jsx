import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../auth/authSlice";

import COLORS from "../constants/colors";
import RADIUS from "../constants/radius";
import SPACING from "../constants/spacing";
import SHADOW from "../constants/shadow";
import VayyButton from "../components/common/VayyButton";
import VayyCard from "../components/common/VayyCard";
import BusIconBadge from "../components/common/BusIconBadge";

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
  };

  const isDriver = user?.role === "driver";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        <VayyCard style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarContainer}>
              <BusIconBadge size={60} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.full_name || user?.name || "User Name"}</Text>
              <Text style={styles.userEmail}>{user?.email || "user@example.com"}</Text>
              <View style={[styles.roleBadge, isDriver ? styles.driverBadge : styles.passengerBadge]}>
                <Text style={[styles.roleText, isDriver ? styles.driverText : styles.passengerText]}>
                  {user?.role?.toUpperCase() || "PASSENGER"}
                </Text>
              </View>
            </View>
          </View>
        </VayyCard>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
          <VayyCard style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Full Name</Text>
              <Text style={styles.detailValue}>{user?.full_name || user?.name || "--"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{user?.email || "--"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>City</Text>
              <Text style={styles.detailValue}>{user?.city || "--"}</Text>
            </View>
            {isDriver && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Employee ID</Text>
                  <Text style={styles.detailValue}>{user?.employee_id || "VAYY-782"}</Text>
                </View>
              </>
            )}
          </VayyCard>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <VayyCard style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.settingAction}>Enabled</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem}>
              <Text style={styles.settingLabel}>Language</Text>
              <Text style={styles.settingAction}>English</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem}>
              <Text style={styles.settingLabel}>Privacy Policy</Text>
              <Text style={styles.settingAction}>View</Text>
            </TouchableOpacity>
          </VayyCard>
        </View>

        <View style={styles.footer}>
          <VayyButton
            label="Log Out"
            onPress={handleLogout}
            variant="outline"
            fullWidth
          />
          <Text style={styles.versionText}>Vayy App v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.base,
    paddingBottom: 40,
  },
  header: {
    marginBottom: SPACING.lg,
    marginTop: Platform.OS === "android" ? StatusBar.currentHeight + SPACING.base : SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
  },
  profileCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: SPACING.lg,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  driverBadge: {
    backgroundColor: COLORS.success,
  },
  passengerBadge: {
    backgroundColor: "#EFF6FF", // Light blue
  },
  roleText: {
    fontSize: 10,
    fontWeight: "900",
  },
  driverText: {
    color: COLORS.primary,
  },
  passengerText: {
    color: "#2563EB", // Blue
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textLight,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
  detailsCard: {
    paddingHorizontal: SPACING.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
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
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  settingsCard: {
    paddingHorizontal: SPACING.md,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
  },
  settingLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "700",
  },
  settingAction: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "800",
  },
  footer: {
    marginTop: SPACING.lg,
    alignItems: "center",
    gap: SPACING.md,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
});
