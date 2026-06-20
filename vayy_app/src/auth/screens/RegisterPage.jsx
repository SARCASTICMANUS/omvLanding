import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Lock, Eye, EyeOff, User, Mail, ArrowLeft } from "lucide-react-native";

import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SPACING from "../../shared/constants/spacing";
import { registerUser } from "../authSlice";

const RegisterPage = ({ navigation }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "passenger",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const toggleShowPassword = () => setShowPassword(!showPassword);

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = () => {
    dispatch(registerUser(formData));
  };

  const getInputWrapperStyle = (field) => [
    styles.inputWrapper,
    focusedField === field && styles.inputWrapperFocused,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -150}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={24} color={COLORS.black} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join VAYY to start your journey</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error.email?.[0] ||
                  error.password?.[0] ||
                  error.error ||
                  "Registration failed."}
              </Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <View style={[getInputWrapperStyle("first_name"), { flex: 1 }]}>
              <User size={20} color={focusedField === "first_name" ? COLORS.primary : COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                onFocus={() => setFocusedField("first_name")}
                onBlur={() => setFocusedField(null)}
                onChangeText={(value) => updateField("first_name", value)}
                placeholder="First name"
                placeholderTextColor={COLORS.textLight}
                style={styles.input}
                value={formData.first_name}
              />
            </View>
            <View style={[getInputWrapperStyle("last_name"), { flex: 1 }]}>
              <User size={20} color={focusedField === "last_name" ? COLORS.primary : COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                onFocus={() => setFocusedField("last_name")}
                onBlur={() => setFocusedField(null)}
                onChangeText={(value) => updateField("last_name", value)}
                placeholder="Last name"
                placeholderTextColor={COLORS.textLight}
                style={styles.input}
                value={formData.last_name}
              />
            </View>
          </View>

          <View style={getInputWrapperStyle("email")}>
            <Mail size={20} color={focusedField === "email" ? COLORS.primary : COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(value) => updateField("email", value)}
              placeholder="Email address"
              placeholderTextColor={COLORS.textLight}
              style={styles.input}
              value={formData.email}
            />
          </View>

          <View style={getInputWrapperStyle("password")}>
            <Lock size={20} color={focusedField === "password" ? COLORS.primary : COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              onChangeText={(value) => updateField("password", value)}
              placeholder="Password"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPassword}
              style={styles.input}
              value={formData.password}
            />
            <TouchableOpacity onPress={toggleShowPassword}>
              {showPassword ? (
                <EyeOff size={20} color={COLORS.textLight} />
              ) : (
                <Eye size={20} color={COLORS.textLight} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.roleRow}>
            {["passenger", "driver"].map((role) => (
              <TouchableOpacity
                key={role}
                onPress={() => updateField("role", role)}
                style={[
                  styles.roleButton,
                  formData.role === role && styles.roleButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    formData.role === role && styles.roleTextActive,
                  ]}
                >
                  {role === "passenger" ? "Passenger" : "Driver"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={loading}
            onPress={handleSubmit}
            style={[styles.primaryButton, loading && styles.disabledButton]}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryText}>Create Account  →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkButton}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Sign in</Text></Text>
          </TouchableOpacity>
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
  content: {
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
    color: COLORS.black,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: COLORS.errorLight,
    borderColor: "#fecaca",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.borderMedium,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.white,
    height: 56,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#f0faf2",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    height: "100%",
  },
  roleRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: 24,
  },
  roleButton: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: COLORS.borderMedium,
    borderRadius: 14,
    borderWidth: 1.5,
    flex: 1,
    height: 48,
    justifyContent: "center",
  },
  roleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  roleTextActive: {
    color: COLORS.white,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    marginTop: 24,
    padding: SPACING.sm,
  },
  linkText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  linkHighlight: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});

export default RegisterPage;
