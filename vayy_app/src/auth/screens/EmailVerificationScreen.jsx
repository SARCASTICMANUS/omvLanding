import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, User, Mail, ShieldCheck } from "lucide-react-native";
import COLORS from "../../shared/constants/colors";
import BottomStickyButton from "../components/BottomStickyButton";
import { useDispatch } from "react-redux";
import { setField } from "../../store/slices/onboardingSlice";
import { resendOtp } from "../authSlice";

const ROLE_LABEL = { passenger: "Buddy", driver: "Marshal" };

export default function EmailVerificationScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const role = route?.params?.role || "passenger";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [resendTimer, setResendTimer] = useState(60);
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState({});
  const [tosAccepted, setTosAccepted] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    let interval;
    if (resendDisabled && resendTimer > 0) {
      interval = setInterval(() => setResendTimer((p) => p - 1), 1000);
    } else if (resendTimer === 0) {
      setResendDisabled(false);
    }
    return () => clearInterval(interval);
  }, [resendDisabled, resendTimer]);

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Full name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Enter a valid email";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendOtp = () => {
    if (!validate()) return;
    setOtpSent(true);
    setResendTimer(60);
    setResendDisabled(true);
    setOtp(["", "", "", ""]);
    setErrors({});
    setTimeout(() => otpRefs.current[0]?.focus(), 300);
  };

  const handleOtpChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, "");
    if (digit.length > 1) return;
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 3) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const code = otp.join("");
    if (code.length !== 4) return;
    if (code === "0000") {
      setIsVerified(true);
      dispatch(setField({ field: "fullName", value: name.trim() }));
      dispatch(setField({ field: "email", value: email.trim().toLowerCase() }));
      dispatch(setField({ field: "role", value: role }));
      dispatch(setField({ field: "verifiedEmail", value: email.trim().toLowerCase() }));
    } else {
      setErrors({ otp: "Invalid OTP. Try 0000 for testing." });
    }
  };

  const handleResend = () => {
    setOtp(["", "", "", ""]);
    setErrors({});
    setResendTimer(60);
    setResendDisabled(true);
    setTimeout(() => otpRefs.current[0]?.focus(), 300);
  };

  const handleContinue = () => {
    if (role === "passenger") {
      navigation.navigate("PassengerRegistration");
    } else {
      navigation.navigate("DriverRegistration");
    }
  };

  const inputStyle = (field) => [
    styles.inputWrap,
    focused[field] && styles.inputFocused,
    errors[field] && styles.inputError,
  ];

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.sub}>Set up your {ROLE_LABEL[role]} account</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBox}>
            <ShieldCheck size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>Use your official email for safety and verified rides</Text>
          </View>

          <Text style={styles.label}>Full Name</Text>
          <View style={inputStyle("name")}>
            <User size={18} color={focused.name ? COLORS.primary : "#9ca3af"} />
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#aaa"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!isVerified}
              onFocus={() => setFocused({ name: true })}
              onBlur={() => setFocused({})}
            />
          </View>
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          <Text style={styles.label}>Email</Text>
          <View style={inputStyle("email")}>
            <Mail size={18} color={focused.email ? COLORS.primary : "#9ca3af"} />
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isVerified && !otpSent}
              onFocus={() => setFocused({ email: true })}
              onBlur={() => setFocused({})}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          {!otpSent && !isVerified && (
            <>
              <TouchableOpacity
                style={styles.tosRow}
                onPress={() => setTosAccepted(!tosAccepted)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}>
                  {tosAccepted && <Text style={styles.checkmark}>{"\u2713"}</Text>}
                </View>
                <Text style={styles.tosText}>
                  I agree to the{" "}
                  <Text style={styles.tosLink} onPress={() => navigation.navigate("TermsOfService")}>
                    Terms of Service
                  </Text>
                </Text>
              </TouchableOpacity>
              <View style={{ marginTop: 12 }}>
                <BottomStickyButton label="Send OTP" onPress={handleSendOtp} loading={loading} disabled={!name.trim() || !email.trim() || !tosAccepted} />
              </View>
            </>
          )}

          {otpSent && !isVerified && (
            <>
              <Text style={styles.label}>Enter OTP sent to {email}</Text>
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { otpRefs.current[i] = r; }}
                    style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                    value={digit}
                    onChangeText={(t) => handleOtpChange(t, i)}
                    onKeyPress={(e) => handleOtpKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>
              {errors.otp && <Text style={styles.errorText}>{errors.otp}</Text>}
              <View style={styles.timerRow}>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimer}>Resend in 00:{resendTimer.toString().padStart(2, "0")}</Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>
              <BottomStickyButton label="Verify" onPress={handleVerify} loading={loading} disabled={otp.join("").length !== 4} />
            </>
          )}

          {isVerified && (
            <>
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>Email Verified</Text>
              </View>
              <BottomStickyButton label={`Continue as ${ROLE_LABEL[role]}`} onPress={handleContinue} />
            </>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: 16, marginTop: 8 },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2, marginBottom: 4 },
  scroll: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { paddingBottom: 100 },
  infoBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f0faf2", borderRadius: 12,
    padding: 14, gap: 10, marginBottom: 20, borderWidth: 1, borderColor: "#d1fae5",
  },
  infoText: { fontSize: 13, color: "#166534", flex: 1, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 6, marginTop: 8 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb",
    borderRadius: 14, paddingHorizontal: 14, height: 52, backgroundColor: "#fafafa", gap: 10,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: "#f0faf2" },
  inputError: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  input: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 4, marginBottom: 4, marginLeft: 4 },
  otpRow: { flexDirection: "row", gap: 14, marginBottom: 16, marginTop: 8, justifyContent: "center" },
  otpInput: {
    width: 56, height: 60, borderWidth: 1.5, borderColor: COLORS.borderMedium,
    borderRadius: 14, textAlign: "center", fontSize: 24, fontWeight: "700",
    color: COLORS.text, backgroundColor: "#fafafa",
  },
  otpInputFilled: { borderColor: COLORS.primary, backgroundColor: "#f0faf2" },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  resendTimer: { fontSize: 13, color: COLORS.textMuted },
  resendText: { fontSize: 13, color: COLORS.primary, fontWeight: "700" },
  successBadge: {
    backgroundColor: "#f0faf2", borderRadius: 20, paddingVertical: 10,
    paddingHorizontal: 20, alignSelf: "center", marginTop: 8, marginBottom: 16,
    borderWidth: 1, borderColor: "#d1fae5",
  },
  successBadgeText: { color: "#166534", fontSize: 14, fontWeight: "700" },
  tosRow: {
    flexDirection: "row", alignItems: "center", marginTop: 20, gap: 10,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#d1d5db",
    backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
  },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  tosText: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  tosLink: { color: COLORS.primary, fontWeight: "700" },
});
