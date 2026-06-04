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

import { Lock, Eye, EyeOff } from "lucide-react-native";

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

  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = () => {
    dispatch(registerUser(formData));
  };

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
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
          </View>
          <Text style={styles.subtitle}>Use your email and password to start.</Text>

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
            <TextInput
              onChangeText={(value) => updateField("first_name", value)}
              placeholder="First name"
              placeholderTextColor={COLORS.textLight}
              style={[styles.input, styles.halfInput]}
              value={formData.first_name}
            />
            <TextInput
              onChangeText={(value) => updateField("last_name", value)}
              placeholder="Last name"
              placeholderTextColor={COLORS.textLight}
              style={[styles.input, styles.halfInput]}
              value={formData.last_name}
            />
          </View>

          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(value) => updateField("email", value)}
            placeholder="Email address"
            placeholderTextColor={COLORS.textLight}
            style={styles.input}
            value={formData.email}
          />

          <View style={styles.inputWrapper}>
            <Lock size={20} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              onChangeText={(value) => updateField("password", value)}
              placeholder="Password"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPassword}
              style={styles.input}
              value={formData.password}
            />
            <TouchableOpacity onPress={toggleShowPassword}>
              {showPassword ? <EyeOff size={20} color={COLORS.textLight} /> : <Eye size={20} color={COLORS.textLight} />}
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
              <Text style={styles.primaryText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkButton}>
            <Text style={styles.linkText}>Back to sign in</Text>
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
    marginBottom: 24,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
  },
  backIcon: {
    fontSize: 20,
    color: "#111111",
    fontWeight: "600",
  },
  title: {
    color: COLORS.black,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  errorBox: {
    backgroundColor: COLORS.errorLight,
    borderColor: "#fecaca",
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    height: 52,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: SPACING.sm,
    color: COLORS.textLight,
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
    marginBottom: SPACING.lg,
  },
  roleButton: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: COLORS.borderMedium,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    flex: 1,
    height: 46,
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
    borderRadius: RADIUS.md,
    height: 54,
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.72,
  },
  primaryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    marginTop: SPACING.lg,
    padding: SPACING.sm,
  },
  linkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});

export default RegisterPage;
