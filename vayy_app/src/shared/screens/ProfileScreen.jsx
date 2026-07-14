import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { logout as logoutUser } from "../../auth/authSlice";
import { fetchProfile } from "../../store/slices/profileSlice";

import COLORS from "../constants/colors";
import RADIUS from "../constants/radius";
import SPACING from "../constants/spacing";
import SHADOW from "../constants/shadow";
import VayyButton from "../components/common/VayyButton";
import VayyCard from "../components/common/VayyCard";
import VehicleIconBadge from "../components/common/VehicleIconBadge";
import { DRIVER_ROLES } from "../../constants";

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { data: profile, loading } = useSelector((state) => state.profile);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

    const handleLogout = () => {
    dispatch(logoutUser());
  };

  const handleEditProfile = () => {
    navigation.navigate("EditProfile");
  };

  const isDriver = DRIVER_ROLES.includes(user?.role);
  const displayName = profile?.display_name || user?.full_name || user?.name || "User Name";
  const phoneNumber = profile?.phone_number || "--";
  const licenseNumber = profile?.license_number;
  const vehicleNumber = profile?.vehicle_number || "--";
  const vehicleType = profile?.vehicle_type;
  const rating = profile?.rating;
  const totalTrips = profile?.total_trips || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        <VayyCard style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarContainer}>
              <VehicleIconBadge size={60} vehicleType={vehicleType} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userEmail}>{user?.email || "user@example.com"}</Text>
              <View style={[styles.roleBadge, isDriver ? styles.driverBadge : styles.passengerBadge]}>
                <Text style={[styles.roleText, isDriver ? styles.driverText : styles.passengerText]}>
                  {user?.role?.toUpperCase() || "PASSENGER"}
                </Text>
              </View>
              {isDriver && rating && (
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingStar}>★</Text>
                  <Text style={styles.ratingTextValue}>{rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
        </VayyCard>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
          <VayyCard style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Full Name</Text>
              <Text style={styles.detailValue}>{displayName}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{user?.email || "--"}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{phoneNumber}</Text>
            </View>
            {isDriver && licenseNumber && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>License</Text>
                  <Text style={styles.detailValue}>{licenseNumber}</Text>
                </View>
              </>
            )}
            {isDriver && vehicleNumber ? (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vehicle</Text>
                  <Text style={styles.detailValue}>{vehicleNumber}</Text>
                </View>
              </>
            ) : user?.city ? (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>City</Text>
                  <Text style={styles.detailValue}>{user.city}</Text>
                </View>
              </>
            ) : null}
          </VayyCard>
          <View style={styles.editProfileWrapper}>
            <VayyButton
              label="Edit Profile"
              onPress={handleEditProfile}
              variant="outline"
              fullWidth
              size="md"
            />
          </View>
        </View>

        {isDriver && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <VayyCard style={styles.earningsCard}>
              <View style={styles.earningsRow}>
                <View style={styles.earningsStat}>
                  <Text style={styles.earningsLabel}>Rating</Text>
                  <Text style={styles.earningsValue}>{rating ? rating.toFixed(1) : "—"}</Text>
                </View>
                <View style={styles.earningsDivider} />
                <View style={styles.earningsStat}>
                  <Text style={styles.earningsLabel}>Trips</Text>
                  <Text style={styles.earningsValue}>{totalTrips}</Text>
                </View>
                <View style={styles.earningsDivider} />
                <View style={styles.earningsStat}>
                  <Text style={styles.earningsLabel}>Vehicle</Text>
                  <Text style={styles.earningsValue}>{vehicleType ? vehicleType.toUpperCase() : "—"}</Text>
                </View>
              </View>
            </VayyCard>
          </View>
        )}

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

  /* earnings */
  editProfileWrapper: {
    marginTop: SPACING.md,
  },
  earningsCard: {
    padding: SPACING.lg,
  },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  earningsStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
  },
  earningsDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  ratingStar: {
    fontSize: 14,
    color: "#F59E0B",
  },
  ratingTextValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
});
