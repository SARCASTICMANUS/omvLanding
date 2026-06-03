import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SHADOW from "../../constants/shadow";
import SPACING from "../../constants/spacing";
import { googleLogin, loginUser } from "../../features/auth/authSlice";

const LoginPage = ({ navigation }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);

  const { loading, error } = useSelector((state) => state.auth);

  const dispatch = useDispatch();

  const handleSubmit = () => {
    dispatch(loginUser(formData));
  };

  const handleGoogleAuth = () => {
    dispatch(googleLogin(""));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroOverlay} />
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                <Text style={styles.logoLetter}>V</Text>
              </View>
              <View>
                <Text style={styles.logoText}>VAYY</Text>
                <Text style={styles.logoSubtext}>Smart. Simple. Seamless.</Text>
              </View>
            </View>

            <View style={styles.busIllustration}>
              <View style={styles.busBody}>
                <View style={styles.busWindow} />
                <View style={styles.busWindow} />
                <View style={styles.busWindow} />
              </View>
              <View style={styles.wheelRow}>
                <View style={styles.wheel} />
                <View style={styles.wheel} />
              </View>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroHeadline}>Better Commutes.</Text>
              <Text style={styles.heroHeadlineAccent}>Smarter Cities.</Text>
              <View style={styles.underline} />
            </View>
          </View>

          <View style={styles.sheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue to your account</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Login Failed</Text>
                <Text style={styles.errorText}>
                  {typeof error === "string"
                    ? error.slice(0, 100)
                    : error.detail || error.error || "Invalid email or password."}
                </Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>@</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(email) => setFormData({ ...formData, email })}
                  placeholder="name@company.com"
                  placeholderTextColor={COLORS.textLight}
                  style={styles.input}
                  value={formData.email}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>*</Text>
                <TextInput
                  onChangeText={(password) => setFormData({ ...formData, password })}
                  placeholder="Password"
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry
                  style={styles.input}
                  value={formData.password}
                />
              </View>
            </View>

            <View style={styles.formMetaRow}>
              <Pressable
                onPress={() => setRememberMe((value) => !value)}
                style={styles.rememberRow}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe ? <Text style={styles.checkboxMark}>x</Text> : null}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <TouchableOpacity>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              onPress={handleSubmit}
              style={[styles.signInButton, loading && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.signInText}>Sign In </Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleGoogleAuth}
                style={styles.socialButton}
              >
                <Text style={styles.googleMark}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.socialButton}>
                <View style={styles.microsoftGrid}>
                  <View style={[styles.msTile, styles.msRed]} />
                  <View style={[styles.msTile, styles.msGreen]} />
                  <View style={[styles.msTile, styles.msBlue]} />
                  <View style={[styles.msTile, styles.msYellow]} />
                </View>
                <Text style={styles.socialText}>Microsoft</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.registerText}>
              Don&apos;t have an account?{" "}
              <Text
                onPress={() => navigation.navigate("RegisterPage")}
                style={styles.registerLink}
              >
                Create free account
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
  },
  hero: {
    minHeight: 330,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    backgroundColor: "#053D24",
    overflow: "hidden",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  logoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    zIndex: 1,
  },
  logoBox: {
    alignItems: "center",
    backgroundColor: COLORS.liveAccent,
    borderRadius: RADIUS.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  logoLetter: {
    color: "#03130A",
    fontSize: 22,
    fontWeight: "900",
  },
  logoText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
  logoSubtext: {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: 11,
  },
  busIllustration: {
    alignItems: "center",
    marginTop: SPACING.xxl,
    zIndex: 1,
  },
  busBody: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    gap: SPACING.sm,
    height: 74,
    padding: SPACING.md,
    width: 230,
  },
  busWindow: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: RADIUS.sm,
    flex: 1,
  },
  wheelRow: {
    flexDirection: "row",
    gap: 120,
    marginTop: -12,
  },
  wheel: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.white,
    borderRadius: RADIUS.full,
    borderWidth: 4,
    height: 30,
    width: 30,
  },
  heroCopy: {
    marginTop: SPACING.xxl,
    zIndex: 1,
  },
  heroHeadline: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
  },
  heroHeadlineAccent: {
    color: COLORS.liveAccent,
    fontSize: 34,
    fontWeight: "900",
  },
  underline: {
    backgroundColor: COLORS.liveAccent,
    borderRadius: RADIUS.full,
    height: 4,
    marginTop: SPACING.base,
    width: 52,
  },
  sheet: {
    ...SHADOW.md,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    marginTop: -SPACING.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  dragHandle: {
    alignSelf: "center",
    backgroundColor: COLORS.borderMedium,
    borderRadius: RADIUS.full,
    height: 5,
    marginBottom: SPACING.xl,
    width: 44,
  },
  title: {
    color: COLORS.black,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    marginTop: SPACING.sm,
  },
  errorBox: {
    backgroundColor: COLORS.errorLight,
    borderColor: "#fecaca",
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  errorTitle: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    marginTop: SPACING.xs,
  },
  fieldGroup: {
    marginTop: SPACING.lg,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  inputWrap: {
    alignItems: "center",
    borderColor: COLORS.borderMedium,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    flexDirection: "row",
    height: 52,
    paddingHorizontal: SPACING.base,
  },
  inputIcon: {
    color: COLORS.textLight,
    fontSize: 17,
    fontWeight: "700",
    marginRight: SPACING.md,
    width: 18,
  },
  input: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  formMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.lg,
  },
  rememberRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  checkbox: {
    alignItems: "center",
    borderColor: "#d1d5db",
    borderRadius: 4,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxMark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "900",
  },
  rememberText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  signInButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 54,
    justifyContent: "center",
    marginTop: SPACING.xl,
  },
  disabledButton: {
    opacity: 0.72,
  },
  signInText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  divider: {
    backgroundColor: COLORS.borderMedium,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: COLORS.textLight,
    fontSize: 13,
  },
  socialRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  socialButton: {
    alignItems: "center",
    borderColor: COLORS.borderMedium,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    height: 48,
    justifyContent: "center",
  },
  googleMark: {
    color: "#4285F4",
    fontSize: 16,
    fontWeight: "900",
  },
  microsoftGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    height: 16,
    width: 16,
  },
  msTile: {
    height: 7,
    margin: 0.5,
    width: 7,
  },
  msRed: {
    backgroundColor: "#f35325",
  },
  msGreen: {
    backgroundColor: "#81bc06",
  },
  msBlue: {
    backgroundColor: "#05a6f0",
  },
  msYellow: {
    backgroundColor: "#ffba08",
  },
  socialText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  registerText: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: SPACING.xl,
    textAlign: "center",
  },
  registerLink: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});

export default LoginPage;
