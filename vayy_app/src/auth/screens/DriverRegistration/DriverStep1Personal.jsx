import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, Phone, Calendar } from "lucide-react-native";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import PasswordChecklist from "../../components/PasswordChecklist";
import BottomStickyButton from "../../components/BottomStickyButton";
import { VALIDATORS, VALIDATION_MESSAGES } from "../../validators";

const GENDERS = ["Male", "Female", "Other"];

export default function DriverStep1Personal({ onNext, onBack }) {
  const [form, setForm] = useState({
    fullName: "", mobile: "", email: "", password: "", confirmPassword: "",
    dob: "", gender: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState({});
  const [errors, setErrors] = useState({});
  const update = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const validate = () => {
    const e = {};
    if (!VALIDATORS.fullName(form.fullName)) e.fullName = VALIDATION_MESSAGES.fullName;
    if (!VALIDATORS.mobile(form.mobile)) e.mobile = VALIDATION_MESSAGES.mobile;
    if (!VALIDATORS.email(form.email)) e.email = VALIDATION_MESSAGES.email;
    if (!VALIDATORS.password(form.password)) e.password = VALIDATION_MESSAGES.password;
    if (form.password !== form.confirmPassword) e.confirmPassword = VALIDATION_MESSAGES.confirmPassword;
    if (!form.dob) e.dob = "Enter your date of birth";
    if (!form.gender) e.gender = "Select your gender";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputStyle = (f) => [styles.inputWrap, focused[f] && styles.inputFocused, errors[f] && styles.inputError];

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity><Text style={styles.draft}>Save Draft</Text></TouchableOpacity>
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Personal Details</Text>
          <Text style={styles.sub}>Tell us about yourself</Text>
        </View>
        <ProgressBar current={1} total={6} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Full Name</Text>
          <View style={inputStyle("fullName")}>
            <User size={18} color={focused.fullName ? COLORS.primary : "#9ca3af"} />
            <TextInput style={styles.input} placeholder="As per Aadhaar" placeholderTextColor="#aaa" value={form.fullName} onChangeText={(v) => update("fullName", v)} autoCapitalize="words" onFocus={() => setFocused({ fullName: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.fullName && <Text style={styles.err}>{errors.fullName}</Text>}

          <Text style={styles.label}>Mobile Number</Text>
          <View style={inputStyle("mobile")}>
            <Phone size={18} color={focused.mobile ? COLORS.primary : "#9ca3af"} />
            <TextInput style={styles.input} placeholder="9876543210" placeholderTextColor="#aaa" value={form.mobile} onChangeText={(v) => update("mobile", v.replace(/[^0-9]/g, "").slice(0, 10))} keyboardType="phone-pad" maxLength={10} onFocus={() => setFocused({ mobile: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.mobile && <Text style={styles.err}>{errors.mobile}</Text>}

          <Text style={styles.label}>Email</Text>
          <View style={inputStyle("email")}>
            <Mail size={18} color={focused.email ? COLORS.primary : "#9ca3af"} />
            <TextInput style={styles.input} placeholder="email@example.com" placeholderTextColor="#aaa" value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" onFocus={() => setFocused({ email: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.email && <Text style={styles.err}>{errors.email}</Text>}

          <Text style={styles.label}>Password</Text>
          <View style={inputStyle("password")}>
            <Lock size={18} color={focused.password ? COLORS.primary : "#9ca3af"} />
            <TextInput style={styles.input} placeholder="Create a strong password" placeholderTextColor="#aaa" value={form.password} onChangeText={(v) => update("password", v)} secureTextEntry={!showPassword} autoCapitalize="none" onFocus={() => setFocused({ password: true })} onBlur={() => setFocused({})} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={18} color="#888" /> : <Eye size={18} color="#888" />}
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.err}>{errors.password}</Text>}
          <PasswordChecklist password={form.password} />

          <Text style={styles.label}>Confirm Password</Text>
          <View style={inputStyle("confirmPassword")}>
            <Lock size={18} color={focused.confirmPassword ? COLORS.primary : "#9ca3af"} />
            <TextInput style={styles.input} placeholder="Re-enter password" placeholderTextColor="#aaa" value={form.confirmPassword} onChangeText={(v) => update("confirmPassword", v)} secureTextEntry={!showConfirm} autoCapitalize="none" onFocus={() => setFocused({ confirmPassword: true })} onBlur={() => setFocused({})} />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
              {showConfirm ? <EyeOff size={18} color="#888" /> : <Eye size={18} color="#888" />}
            </TouchableOpacity>
          </View>
          {errors.confirmPassword && <Text style={styles.err}>{errors.confirmPassword}</Text>}

          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity style={inputStyle("dob")} onPress={() => {}} activeOpacity={1}>
            <Calendar size={18} color={focused.dob ? COLORS.primary : "#9ca3af"} />
            <TextInput style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor="#aaa" value={form.dob} onChangeText={(v) => update("dob", v)} keyboardType="numbers-and-punctuation" maxLength={10} onFocus={() => setFocused({ dob: true })} onBlur={() => setFocused({})} />
          </TouchableOpacity>
          {errors.dob && <Text style={styles.err}>{errors.dob}</Text>}

          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity key={g} style={[styles.genderPill, form.gender === g && styles.genderPillActive]} onPress={() => update("gender", g)} activeOpacity={0.7}>
                <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.gender && <Text style={styles.err}>{errors.gender}</Text>}

          <View style={{ height: 80 }} />
        </ScrollView>
        <BottomStickyButton label="Continue to Vehicle" onPress={() => { if (validate()) onNext(form); }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 24 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: 16 },
  draft: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2, marginBottom: 4 },
  scroll: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { paddingBottom: 100 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 6, marginTop: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 14, paddingHorizontal: 14, height: 52, backgroundColor: "#fafafa", gap: 10 },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: "#f0faf2" },
  inputError: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  input: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  err: { fontSize: 12, color: "#ef4444", marginTop: 4, marginBottom: 4, marginLeft: 4 },
  genderRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  genderPill: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" },
  genderPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  genderText: { fontSize: 14, fontWeight: "600", color: COLORS.textMuted },
  genderTextActive: { color: "#fff" },
});
