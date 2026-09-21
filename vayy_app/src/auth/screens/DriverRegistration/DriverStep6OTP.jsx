import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useDispatch, useSelector } from "react-redux";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import OTPInput from "../../components/OTPInput";
import BottomStickyButton from "../../components/BottomStickyButton";
import { resendRegistrationOtp } from "../../authSlice";

export default function DriverStep6OTP({ onComplete, onBack, email }) {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((s) => s.auth);
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [otpError, setOtpError] = useState(false);

  useEffect(() => {
    if (!resendDisabled || timer <= 0) return;
    const t = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [resendDisabled, timer]);

  useEffect(() => {
    if (timer === 0) setResendDisabled(false);
  }, [timer]);

  const handleResend = () => {
    dispatch(resendRegistrationOtp(email));
    setTimer(30);
    setResendDisabled(true);
    setOtp("");
    setOtpError(false);
  };

  const handleVerify = () => {
    if (otp.length !== 6) return;
    setOtpError(false);
    onComplete?.(otp);
  };

  const apiError = error?.otp?.[0] || error?.error || error?.message;

  return (
    <SafeAreaView style={styles.root}>
      <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Verify Safety Code</Text>
        <Text style={styles.sub}>Enter the code sent to {email}</Text>
        <TouchableOpacity onPress={onBack}><Text style={styles.editLink}>Edit email?</Text></TouchableOpacity>
      </View>
        <ProgressBar current={2} total={2} />
      <View style={styles.body}>
        <OTPInput length={6} onComplete={(v) => { setOtp(v); setOtpError(false); }} error={otpError} />
        {otpError ? (
          <Text style={styles.errorText}>{apiError || "Invalid Safety Code. Try again."}</Text>
        ) : null}
        {timer > 0 ? (
          <Text style={styles.timer}>Resend Safety Code in 00:{timer.toString().padStart(2, "0")}</Text>
        ) : (
          <TouchableOpacity onPress={handleResend}><Text style={styles.resend}>Resend Safety Code</Text></TouchableOpacity>
        )}
      </View>
      <BottomStickyButton label="Verify & Submit" onPress={handleVerify} disabled={otp.length < 6} loading={loading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: 16 },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  editLink: { fontSize: 13, color: COLORS.primary, fontWeight: "600", marginTop: 4 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  errorText: { color: "#ef4444", fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: 16 },
  timer: { textAlign: "center", fontSize: 13, color: COLORS.textMuted, marginTop: 8 },
  resend: { textAlign: "center", fontSize: 13, color: COLORS.primary, fontWeight: "700", marginTop: 8 },
});
