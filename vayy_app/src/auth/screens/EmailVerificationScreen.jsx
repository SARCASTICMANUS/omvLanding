import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, User, Mail, ShieldCheck } from "lucide-react-native";
import COLORS from "../../shared/constants/colors";
import BottomStickyButton from "../components/BottomStickyButton";
import { useDispatch } from "react-redux";
import { setField } from "../../store/slices/onboardingSlice";

const ROLE_LABEL = { passenger: "Buddy", bikedriver: "Marshal", autodriver: "Marshal" };

export default function EmailVerificationScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const role = route?.params?.role || "passenger";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState({});
  const [tosAccepted, setTosAccepted] = useState(false);

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Full name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Enter a valid email";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    dispatch(setField({ field: "fullName", value: name.trim() }));
    dispatch(setField({ field: "email", value: email.trim().toLowerCase() }));
    dispatch(setField({ field: "role", value: role }));
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.sub}>Set up your {ROLE_LABEL[role] || "Buddy"} account</Text>
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
              onFocus={() => setFocused({ email: true })}
              onBlur={() => setFocused({})}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

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
            <BottomStickyButton
              label="Continue"
              onPress={handleContinue}
              disabled={!name.trim() || !email.trim() || !tosAccepted}
            />
          </View>

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
