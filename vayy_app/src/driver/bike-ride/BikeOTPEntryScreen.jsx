import React, { useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import { startDispatchTrip } from "../../store/slices/dispatchSlice";
import COLORS from "../../shared/constants/colors";

export default function BikeOTPEntryScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const dispatchRedux = useDispatch();
  const buddy = route.params?.buddy;
  const dispatchId = route.params?.dispatchId || buddy?.dispatchId;
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [otpError, setOtpError] = useState("");
  const inputs = useRef([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const handleOtpChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const code = otp.join("");
    if (code.length < 4) {
      setOtpError("");
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      return;
    }
    const expectedOtp = String(buddy?.otp || "");
    if (expectedOtp && code !== expectedOtp) {
      setOtpError("Invalid code. Please try again.");
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      return;
    }
    setOtpError("");
    setShowSuccess(true);
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    // Start the trip on backend
    if (dispatchId) {
      dispatchRedux(startDispatchTrip(dispatchId)).catch((e) => {
        console.warn("startDispatchTrip failed:", e);
      });
    }
    setTimeout(() => {
      navigation.replace("BikeRideToDestination", { buddy, dispatchId });
    }, 1200);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Handshake</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.buddyBadge}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{buddy?.avatar || "RK"}</Text>
          </View>
          <View>
            <Text style={styles.buddyName}>{buddy?.name || "Ravi Kumar"}</Text>
            <Text style={styles.buddyDetail}>{buddy?.pickup || "Hazratganj"}</Text>
          </View>
        </View>

        <Text style={styles.instruction}>
          Ask your buddy for the 4-digit code{"\n"}and enter it below
        </Text>

        <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => (inputs.current[i] = ref)}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(t) => handleOtpChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              selectTextOnFocus
            />
          ))}
        </Animated.View>

        {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

        <TouchableOpacity
          style={[styles.verifyBtn, otp.join("").length < 4 && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          activeOpacity={0.85}
          disabled={showSuccess}
        >
          <Ionicons name="shield-checkmark" size={20} color="#fff" />
          <Text style={styles.verifyBtnText}>Verify & Start Ride</Text>
        </TouchableOpacity>
      </View>

      {showSuccess && (
        <Animated.View style={[styles.successOverlay, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={styles.successText}>Handshake Verified!</Text>
        </Animated.View>
      )}
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAF9",
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
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    alignItems: "center",
  },

  /* buddy badge */
  buddyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  buddyName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  buddyDetail: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 1,
  },

  /* instruction */
  instruction: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },

  /* otp */
  otpRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 40,
  },
  otpBox: {
    width: 56,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.primary,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: "#ECFAF1",
  },

  /* verify */
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    height: 56,
    width: "100%",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  verifyBtnDisabled: {
    opacity: 0.4,
  },
  verifyBtnText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },

  /* success */
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(248,250,249,0.96)",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  successText: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: -0.4,
  },
});
