import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, User, CreditCard, Building2, Smartphone } from "lucide-react-native";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import BottomStickyButton from "../../components/BottomStickyButton";
import { VALIDATORS, VALIDATION_MESSAGES } from "../../validators";

export default function DriverStep5Bank({ onNext, onBack }) {
  const [form, setForm] = useState({ holderName: "", accountNumber: "", confirmAccount: "", ifsc: "", upi: "" });
  const [focused, setFocused] = useState({});
  const [errors, setErrors] = useState({});

  const update = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const validate = () => {
    const e = {};
    if (!form.holderName) e.holderName = "Enter account holder name";
    if (!VALIDATORS.accountNumber(form.accountNumber)) e.accountNumber = VALIDATION_MESSAGES.accountNumber;
    if (form.accountNumber !== form.confirmAccount) e.confirmAccount = "Account numbers do not match";
    if (!VALIDATORS.ifsc(form.ifsc)) e.ifsc = VALIDATION_MESSAGES.ifsc;
    if (form.upi && !VALIDATORS.upi(form.upi)) e.upi = VALIDATION_MESSAGES.upi;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputStyle = (f) => [styles.inputWrap, focused[f] && styles.inputFocused, errors[f] && styles.inputError];
  const iconColor = (f) => focused[f] ? COLORS.primary : "#9ca3af";

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>Bank Details</Text>
          <Text style={styles.sub}>Add your payout information</Text>
        </View>
        <ProgressBar current={5} total={6} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Account Holder Name</Text>
          <View style={inputStyle("holderName")}>
            <User size={18} color={iconColor("holderName")} />
            <TextInput style={styles.input} placeholder="As per bank records" placeholderTextColor="#aaa" value={form.holderName} onChangeText={(v) => update("holderName", v)} autoCapitalize="words" onFocus={() => setFocused({ holderName: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.holderName && <Text style={styles.err}>{errors.holderName}</Text>}

          <Text style={styles.label}>Account Number</Text>
          <View style={inputStyle("accountNumber")}>
            <CreditCard size={18} color={iconColor("accountNumber")} />
            <TextInput style={styles.input} placeholder="Enter account number" placeholderTextColor="#aaa" value={form.accountNumber} onChangeText={(v) => update("accountNumber", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" onFocus={() => setFocused({ accountNumber: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.accountNumber && <Text style={styles.err}>{errors.accountNumber}</Text>}

          <Text style={styles.label}>Confirm Account Number</Text>
          <View style={inputStyle("confirmAccount")}>
            <CreditCard size={18} color={iconColor("confirmAccount")} />
            <TextInput style={styles.input} placeholder="Re-enter account number" placeholderTextColor="#aaa" value={form.confirmAccount} onChangeText={(v) => update("confirmAccount", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" onFocus={() => setFocused({ confirmAccount: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.confirmAccount && <Text style={styles.err}>{errors.confirmAccount}</Text>}

          <Text style={styles.label}>IFSC Code</Text>
          <View style={inputStyle("ifsc")}>
            <Building2 size={18} color={iconColor("ifsc")} />
            <TextInput style={styles.input} placeholder="SBIN0001234" placeholderTextColor="#aaa" value={form.ifsc} onChangeText={(v) => update("ifsc", v.toUpperCase())} autoCapitalize="characters" maxLength={11} onFocus={() => setFocused({ ifsc: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.ifsc && <Text style={styles.err}>{errors.ifsc}</Text>}

          <Text style={styles.label}>UPI ID <Text style={{ fontWeight: "400", color: "#9ca3af" }}>(Optional)</Text></Text>
          <View style={inputStyle("upi")}>
            <Smartphone size={18} color={iconColor("upi")} />
            <TextInput style={styles.input} placeholder="name@upi" placeholderTextColor="#aaa" value={form.upi} onChangeText={(v) => update("upi", v)} autoCapitalize="none" onFocus={() => setFocused({ upi: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.upi && <Text style={styles.err}>{errors.upi}</Text>}

          <View style={{ height: 80 }} />
        </ScrollView>
        <BottomStickyButton label="Continue to Verification" onPress={() => { if (validate()) onNext(form); }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: 16 },
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
});
