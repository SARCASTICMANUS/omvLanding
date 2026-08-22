import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Mail } from "lucide-react-native";

import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import RADIUS from "../../shared/constants/radius";
import { verifyOtp, resendOtp } from "../authSlice";

const OtpVerificationPage = ({ navigation, route }) => {
  const email = route?.params?.email || "";
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    let interval;
    if (resendDisabled && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setResendDisabled(false);
    }
    return () => clearInterval(interval);
  }, [resendDisabled, resendTimer]);

  const handleOtpChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, "");
    if (digit.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key, index) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) return;

    dispatch(verifyOtp({ email, otp: otpString })).then((result) => {
      if (verifyOtp.fulfilled.match(result)) {
        navigation.navigate("LoginPage");
      }
    });
  };

  const handleResend = () => {
    dispatch(resendOtp(email));
    setResendDisabled(true);
    setResendTimer(30);
    setOtp(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  const isOtpComplete = otp.every((d) => d !== "");

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={24} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.title}>Verify OTP</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Mail size={32} color={COLORS.primary} />
            </View>

            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to
            </Text>
            <Text style={styles.emailText}>{email}</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {error.otp?.[0] || error.error || "Invalid OTP. Please try again."}
                </Text>
              </View>
            ) : null}

            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading || !isOtpComplete}
              onPress={handleVerify}
              style={[styles.verifyButton, (!isOtpComplete || loading) && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.verifyText}>Verify OTP  →</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive the code? </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={resendDisabled}
                activeOpacity={0.7}
              >
                <Text style={[styles.resendLink, resendDisabled && styles.resendLinkDisabled]}>
                  {resendDisabled ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + SPACING.base : 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f0faf2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 32,
  },
  errorBox: {
    backgroundColor: COLORS.errorLight,
    borderColor: "#fecaca",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    width: "100%",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    textAlign: "center",
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: COLORS.borderMedium,
    borderRadius: RADIUS.md,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    backgroundColor: "#fafafa",
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: "#f0faf2",
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  verifyText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  resendLinkDisabled: {
    color: COLORS.textLight,
  },
});

export default OtpVerificationPage;
