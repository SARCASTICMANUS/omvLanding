import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../shared/constants/colors";

export default function BikeOTPHandshakeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const buddy = route.params?.buddy;
  const otp = "4286";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Buddy</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={40} color={COLORS.primary} />
        </View>

        {buddy && (
          <View style={styles.buddyBadge}>
            <View style={styles.buddyAvatar}>
              <Text style={styles.buddyAvatarText}>{buddy.avatar}</Text>
            </View>
            <View>
              <Text style={styles.buddyName}>{buddy.name}</Text>
              <Text style={styles.buddyDetail}>{buddy.pickup} → {buddy.drop}</Text>
            </View>
          </View>
        )}

        <Text style={styles.otpLabel}>Share this OTP with your buddy</Text>
        <View style={styles.otpBox}>
          {otp.split("").map((d, i) => (
            <View key={i} style={styles.otpDigit}>
              <Text style={styles.otpDigitText}>{d}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => navigation.navigate("BikeTracking", { buddy })}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.confirmBtnText}>Confirm & Start Ride</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  buddyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buddyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buddyAvatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  buddyName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  buddyDetail: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 2,
  },
  otpLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 8,
    letterSpacing: 0.3,
  },
  otpBox: {
    flexDirection: "row",
    gap: 10,
  },
  otpDigit: {
    width: 52,
    height: 64,
    borderRadius: 14,
    backgroundColor: COLORS.primary + "08",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary + "30",
  },
  otpDigitText: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 4,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 12,
    width: "100%",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
});
