import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle, ShieldCheck } from "lucide-react-native";

import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import RADIUS from "../../shared/constants/radius";
import { AUTH } from "../../constants";

const STEPS = { EMAIL: 0, OTP: 1, SUCCESS: 2 };

const PasswordResetPage = ({ navigation }) => {
  const dispatch = useDispatch();
  const { loading, error: reduxError } = useSelector((state) => state.auth);

  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const otpRefs = useRef([]);
  const passwordInputRef = useRef(null);
  const confirmInputRef = useRef(null);

  useEffect(() => {
    if (step === STEPS.OTP) {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

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

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendOtp = async () => {
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      const response = await fetch(
        `https://api.onmyvayy.com${AUTH.forgotPassword}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.error || "Failed to send reset code.");
      }

      setStep(STEPS.OTP);
      setResendDisabled(true);
      setResendTimer(30);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
  };

  const handleOtpChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, "");
    if (digit.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key, index) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      const response = await fetch(
        `https://api.onmyvayy.com${AUTH.forgotPassword}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to resend code.");
      }

      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      setResendDisabled(true);
      setResendTimer(30);
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    }
  };

  const getPasswordErrors = () => {
    const errors = [];
    if (password.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
    if (!/[0-9]/.test(password)) errors.push("One number");
    return errors;
  };

  const handleResetPassword = async () => {
    setError(null);

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }

    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch(
        `https://api.onmyvayy.com${AUTH.resetPassword}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp: otpString,
            password,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        if (data.otp) {
          throw new Error(Array.isArray(data.otp) ? data.otp[0] : data.otp);
        }
        if (data.password) {
          throw new Error(Array.isArray(data.password) ? data.password[0] : data.password);
        }
        throw new Error(data.detail || data.error || "Password reset failed.");
      }

      setStep(STEPS.SUCCESS);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
  };

  const handleBack = () => {
    if (step === STEPS.OTP) {
      setStep(STEPS.EMAIL);
      setError(null);
    } else {
      navigation.goBack();
    }
  };

  const passwordErrors = getPasswordErrors();
  const isOtpComplete = otp.every((d) => d !== "");
  const isPasswordValid = password.length >= 8 && password === confirmPassword;

  const renderEmailStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <Mail size={32} color={COLORS.primary} />
      </View>

      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>
        Enter the email address associated with your account and we'll send you a 6-digit code to reset your password.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Email Address</Text>
      <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
        <Mail size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.input}
          placeholder="name@company.com"
          placeholderTextColor={COLORS.textLight}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          returnKeyType="done"
          onSubmitEditing={handleSendOtp}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.disabledButton]}
        onPress={handleSendOtp}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Send Reset Code</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backToLoginLink}
        onPress={() => navigation.navigate("LoginPage")}
        activeOpacity={0.7}
      >
        <Text style={styles.backToLoginText}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <ShieldCheck size={32} color={COLORS.primary} />
      </View>

      <Text style={styles.title}>Enter Reset Code</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to{" "}
        <Text style={styles.emailHighlight}>{email}</Text>
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.otpRow}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { otpRefs.current[index] = ref; }}
            style={[
              styles.otpInput,
              digit ? styles.otpInputFilled : null,
            ]}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      <View style={styles.resendRow}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        <TouchableOpacity
          onPress={handleResend}
          disabled={resendDisabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.resendLink, resendDisabled && styles.resendLinkDisabled]}>
            {resendDisabled ? `Resend in ${resendTimer}s` : "Resend Code"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>New Password</Text>
      <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
        <Lock size={20} color={COLORS.textLight} />
        <TextInput
          ref={passwordInputRef}
          style={styles.input}
          placeholder="Min. 8 characters"
          placeholderTextColor={COLORS.textLight}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          {showPassword ? (
            <EyeOff size={20} color={COLORS.textLight} />
          ) : (
            <Eye size={20} color={COLORS.textLight} />
          )}
        </TouchableOpacity>
      </View>

      {password.length > 0 ? (
        <View style={styles.passwordChecks}>
          {passwordErrors.map((err, i) => (
            <Text key={i} style={styles.passwordCheckError}>• {err}</Text>
          ))}
          {passwordErrors.length === 0 && (
            <Text style={styles.passwordCheckValid}>Password looks good!</Text>
          )}
        </View>
      ) : null}

      <Text style={styles.label}>Confirm Password</Text>
      <View style={[styles.inputWrapper, confirmFocused && styles.inputWrapperFocused]}>
        <Lock size={20} color={COLORS.textLight} />
        <TextInput
          ref={confirmInputRef}
          style={styles.input}
          placeholder="Re-enter password"
          placeholderTextColor={COLORS.textLight}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          autoComplete="new-password"
          onFocus={() => setConfirmFocused(true)}
          onBlur={() => setConfirmFocused(false)}
        />
        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
          {showConfirmPassword ? (
            <EyeOff size={20} color={COLORS.textLight} />
          ) : (
            <Eye size={20} color={COLORS.textLight} />
          )}
        </TouchableOpacity>
      </View>

      {confirmPassword.length > 0 && password !== confirmPassword ? (
        <Text style={styles.mismatchText}>Passwords do not match</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryButton, (!isOtpComplete || !isPasswordValid) && styles.disabledButton]}
        onPress={handleResetPassword}
        disabled={!isOtpComplete || !isPasswordValid}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Reset Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.stepContent}>
      <View style={[styles.iconContainer, styles.successIconContainer]}>
        <CheckCircle size={48} color={COLORS.primary} />
      </View>

      <Text style={styles.title}>Password Reset!</Text>
      <Text style={styles.subtitle}>
        Your password has been successfully reset. You can now sign in with your new password.
      </Text>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate("LoginPage")}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryButtonText}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );

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
              onPress={handleBack}
            >
              <ArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === STEPS.EMAIL && "Reset Password"}
              {step === STEPS.OTP && "Verify Code"}
              {step === STEPS.SUCCESS && "Success"}
            </Text>
          </View>

          {step === STEPS.EMAIL && renderEmailStep()}
          {step === STEPS.OTP && renderOtpStep()}
          {step === STEPS.SUCCESS && renderSuccessStep()}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  stepContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 16,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.successLight,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 28,
    lineHeight: 20,
    textAlign: "center",
  },
  emailHighlight: {
    fontWeight: "700",
    color: COLORS.text,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 14,
    backgroundColor: "#fafafa",
    width: "100%",
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    padding: 0,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
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
    marginBottom: 16,
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
    backgroundColor: COLORS.primaryLight,
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
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
  passwordChecks: {
    alignSelf: "flex-start",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  passwordCheckError: {
    fontSize: 12,
    color: COLORS.error,
    marginBottom: 2,
  },
  passwordCheckValid: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: "600",
  },
  mismatchText: {
    fontSize: 12,
    color: COLORS.error,
    alignSelf: "flex-start",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  backToLoginLink: {
    marginTop: 20,
    paddingVertical: 12,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
});

export default PasswordResetPage;
