import React, { useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../shared/lib/api";
import { AUTH } from "../../constants";

import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import RADIUS from "../../shared/constants/radius";

const PasswordResetPage = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleResetRequest = async () => {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Assuming endpoint exists based on backend conventions
      await api.post(AUTH.forgotPassword, { email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not send reset link. Please check your email.");
    } finally {
      setLoading(false);
    }
  };

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
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Reset Password</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>

            {success ? (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>Email Sent!</Text>
                <Text style={styles.successText}>
                  Check your inbox for instructions on how to reset your password.
                </Text>
                <TouchableOpacity 
                  style={styles.backToLoginBtn}
                  onPress={() => navigation.navigate("LoginPage")}
                >
                  <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>✉</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="name@company.com"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.resetButton, loading && styles.disabledButton]} 
                  onPress={handleResetRequest}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.resetText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
  content: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111111",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#666666",
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 9,
    marginBottom: 24,
    backgroundColor: "#fafafa",
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    color: "#888",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111111",
    padding: 0,
  },
  resetButton: {
    backgroundColor: "#1a8a2e",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1a8a2e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.7,
  },
  resetText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  errorBox: {
    backgroundColor: "#fff1f1",
    borderColor: "#fecaca",
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "500",
  },
  successBox: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: "#166534",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  backToLoginBtn: {
    backgroundColor: "#166534",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backToLoginText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default PasswordResetPage;
