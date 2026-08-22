import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../authSlice";
import { Lock, Mail, Eye, EyeOff, User, Navigation } from "lucide-react-native";

import { ROLE } from "../../constants";

const { height } = Dimensions.get("window");

const LoginPage = ({ navigation }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { loading, error } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [role, setRole] = useState(ROLE.PASSENGER);

  const handleSignIn = () => {
    dispatch(loginUser({ email, password, role }));
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleGoogleSignIn = () => {
    // Google login not implemented on backend
  };

  const handleMicrosoftSignIn = () => {
    // Microsoft login not implemented yet
  };

  const handleForgotPassword = () => {
    navigation.navigate("PasswordReset");
  };

  const handleCreateAccount = () => {
    navigation.navigate("RoleSelection");
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -150}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView 
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={require("../../../assets-webp/LoginAuto.webp")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>VAYY</Text>
            <Text style={styles.heroTagline}>Your Ride. Your Route.</Text>
          </View>
        </View>

        {/* Bottom Sheet */}
        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.dragHandle} />

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your VAYY account</Text>

          <View style={styles.roleToggle}>
            <TouchableOpacity
              style={[styles.rolePill, role === ROLE.PASSENGER && styles.rolePillActive]}
              onPress={() => setRole(ROLE.PASSENGER)}
              activeOpacity={0.7}
            >
              <User size={16} color={role === ROLE.PASSENGER ? '#fff' : '#666'} />
              <Text style={[styles.rolePillText, role === ROLE.PASSENGER && styles.rolePillTextActive]}>
                Passenger
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rolePill, role === ROLE.BIKE_DRIVER && styles.rolePillActive]}
              onPress={() => setRole(ROLE.BIKE_DRIVER)}
              activeOpacity={0.7}
            >
              <Navigation size={16} color={role === ROLE.BIKE_DRIVER ? '#fff' : '#666'} />
              <Text style={[styles.rolePillText, role === ROLE.BIKE_DRIVER && styles.rolePillTextActive]}>
                Driver
              </Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {typeof error === "string"
                  ? error.slice(0, 100)
                  : error.detail || error.error || "Invalid email or password."}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email Address</Text>
          <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
            <Mail size={20} color="#888" />
            <TextInput
              style={styles.input}
              placeholder="name@company.com"
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
            <Lock size={20} color="#888" />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <TouchableOpacity onPress={toggleShowPassword}>
              {showPassword ? <EyeOff size={20} color="#888" /> : <Eye size={20} color="#888" />}
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.signInButton, loading && styles.disabledButton]} 
            onPress={handleSignIn} 
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signInText}>Sign In  →</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn} activeOpacity={0.8}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.socialText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={handleMicrosoftSignIn} activeOpacity={0.8}>
              <Text style={styles.microsoftIcon}>⊞</Text>
              <Text style={styles.socialText}>Microsoft</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.createRow}>
            <Text style={styles.createText}>{"Don't have an account? "}</Text>
            <TouchableOpacity onPress={handleCreateAccount} activeOpacity={0.7}>
              <Text style={styles.createLink}>Create free account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0d1f0f",
  },
  heroContainer: {
    height: height * 0.35,
    backgroundColor: "#053D24",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -1,
  },
  heroTagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  bottomSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    flex: 1,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111111",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 24,
    fontWeight: "400",
  },
  roleToggle: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  rolePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rolePillActive: {
    backgroundColor: "#1a8a2e",
    shadowColor: "#1a8a2e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  rolePillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  rolePillTextActive: {
    color: "#fff",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 14,
    backgroundColor: "#fafafa",
  },
  inputWrapperFocused: {
    borderColor: "#1a8a2e",
    backgroundColor: "#f0faf2",
  },
  inputIcon: {
    fontSize: 15,
    marginRight: 10,
    color: "#888",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111111",
    padding: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: "#cccccc",
    borderRadius: 4,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#1a8a2e",
    borderColor: "#1a8a2e",
  },
  checkmark: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  rememberText: {
    fontSize: 13,
    color: "#444444",
    fontWeight: "500",
  },
  forgotText: {
    fontSize: 13,
    color: "#1a8a2e",
    fontWeight: "600",
  },
  signInButton: {
    backgroundColor: "#1a8a2e",
    borderRadius: 18,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#1a8a2e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.7,
  },
  signInText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#eeeeee",
  },
  dividerText: {
    fontSize: 12,
    color: "#aaaaaa",
    marginHorizontal: 12,
    fontWeight: "500",
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    height: 50,
    backgroundColor: "#ffffff",
    gap: 8,
  },
  googleIcon: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4285F4",
  },
  microsoftIcon: {
    fontSize: 15,
    color: "#F25022",
  },
  socialText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333333",
  },
  createRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  createText: {
    fontSize: 13,
    color: "#888888",
  },
  createLink: {
    fontSize: 13,
    color: "#1a8a2e",
    fontWeight: "700",
  },
});

export default LoginPage;
