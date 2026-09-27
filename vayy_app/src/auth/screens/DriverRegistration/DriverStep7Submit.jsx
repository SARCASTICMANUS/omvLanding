import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle, FileText, CreditCard, Bike } from "lucide-react-native";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import BottomStickyButton from "../../components/BottomStickyButton";

const Section = ({ icon: Icon, title, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Icon size={18} color={COLORS.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || "—"}</Text>
  </View>
);

export default function DriverStep7Submit({ data, onSubmit, onBack, loading }) {
  const docCount = [
    data.dlFront, data.dlBack,
    data.rcFront, data.rcBack,
    data.insuranceFront, data.insuranceBack,
    data.aadhaarFront, data.aadhaarBack,
    data.selfie,
  ].filter(Boolean).length;

  return (
    <SafeAreaView style={styles.root}>
      <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Review & Submit</Text>
        <Text style={styles.sub}>Verify your details before submitting</Text>
      </View>
      <ProgressBar current={7} total={7} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Section icon={CheckCircle} title="Personal Details">
          <Row label="Name" value={data.fullName} />
          <Row label="Email" value={data.email} />
          <Row label="Phone" value={data.mobile} />
          <Row label="DOB" value={data.dob} />
          <Row label="Gender" value={data.gender} />
        </Section>

        <Section icon={Bike} title="Vehicle Details">
          <Row label="Type" value={data.vehicleType === "bike" ? "Bike" : "Auto"} />
          <Row label="Number" value={data.vehicleNumber} />
          <Row label="RC Number" value={data.rcNumber} />
          <Row label="Photo" value={data.photo ? "Uploaded" : "Not uploaded"} />
        </Section>

        <Section icon={FileText} title="Documents">
          <Row label="Files uploaded" value={`${docCount} of 9`} />
        </Section>

        <Section icon={CreditCard} title="Bank Details">
          <Row label="Account Holder" value={data.holderName} />
          <Row label="Account Number" value={data.accountNumber ? "••••" + data.accountNumber.slice(-4) : ""} />
          <Row label="IFSC" value={data.ifsc} />
          <Row label="UPI" value={data.upi} />
        </Section>

        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomStickyButton label="Submit Registration" onPress={onSubmit} loading={loading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: 16 },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  scroll: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { paddingBottom: 100 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  rowLabel: { fontSize: 14, color: COLORS.textMuted },
  rowValue: { fontSize: 14, fontWeight: "600", color: COLORS.text, maxWidth: "60%", textAlign: "right" },
});
