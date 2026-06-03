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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SPACING from "../../constants/spacing";
import { registerUser } from "../../features/auth/authSlice";

const RegisterPage = ({ navigation }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "passenger",
  });

  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = () => {
    dispatch(registerUser(formData));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create Account</Text>
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

          <TextInput
            onChangeText={(value) => updateField("password", value)}
            placeholder="Password"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            style={styles.input}
            value={formData.password}
          />

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
    justifyContent: "center",
    padding: SPACING.xl,
  },
  title: {
    color: COLORS.black,
    fontSize: 30,
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
  input: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.borderMedium,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    color: COLORS.text,
    fontSize: 15,
    height: 52,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.base,
  },
  halfInput: {
    flex: 1,
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
