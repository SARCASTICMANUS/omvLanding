import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import ImageUploadCard from "../../components/ImageUploadCard";
import BottomStickyButton from "../../components/BottomStickyButton";

const SECTIONS = [
  { key: "dl", label: "Driving Licence" },
  { key: "aadhaar", label: "Aadhaar Card" },
  { key: "selfie", label: "Selfie Verification" },
];

export default function DriverStep4Documents({ onNext, onBack }) {
  const [docs, setDocs] = useState({ dlFront: null, dlBack: null, aadhaarFront: null, aadhaarBack: null, selfie: null });
  const [errors, setErrors] = useState({});

  const upload = async (field) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant gallery access to upload documents.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setDocs((p) => ({ ...p, [field]: result.assets[0].uri }));
    }
  };

  const completed = SECTIONS.reduce((acc, s) => {
    if (s.key === "dl") acc[s.key] = !!(docs.dlFront && docs.dlBack);
    else if (s.key === "aadhaar") acc[s.key] = !!(docs.aadhaarFront && docs.aadhaarBack);
    else acc[s.key] = !!docs.selfie;
    return acc;
  }, {});

  const validate = () => {
    const e = {};
    if (!docs.dlFront || !docs.dlBack) e.dl = "Upload both sides of your Driving Licence";
    if (!docs.aadhaarFront || !docs.aadhaarBack) e.aadhaar = "Upload both sides of your Aadhaar";
    if (!docs.selfie) e.selfie = "Take a selfie for verification";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <SafeAreaView style={styles.root}>
      <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.sub}>Upload your documents for verification</Text>
      </View>
      <ProgressBar current={4} total={6} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.summary}>
          <Text style={styles.summaryText}>Documents {Object.values(completed).filter(Boolean).length}/3 completed</Text>
          <View style={styles.summaryTrack}>
            <View style={[styles.summaryFill, { width: `${(Object.values(completed).filter(Boolean).length / 3) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Driving Licence</Text>
            {completed.dl && <CheckCircle size={18} color={COLORS.primary} />}
          </View>
          {errors.dl && <Text style={styles.err}>{errors.dl}</Text>}
          <View style={styles.uploadRow}>
            <ImageUploadCard label="Upload Front" uri={docs.dlFront} onPress={() => upload("dlFront")} />
            <ImageUploadCard label="Upload Back" uri={docs.dlBack} onPress={() => upload("dlBack")} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aadhaar Card</Text>
            {completed.aadhaar && <CheckCircle size={18} color={COLORS.primary} />}
          </View>
          {errors.aadhaar && <Text style={styles.err}>{errors.aadhaar}</Text>}
          <View style={styles.uploadRow}>
            <ImageUploadCard label="Upload Front" uri={docs.aadhaarFront} onPress={() => upload("aadhaarFront")} />
            <ImageUploadCard label="Upload Back" uri={docs.aadhaarBack} onPress={() => upload("aadhaarBack")} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Selfie Verification</Text>
            {completed.selfie && <CheckCircle size={18} color={COLORS.primary} />}
          </View>
          {errors.selfie && <Text style={styles.err}>{errors.selfie}</Text>}
          <ImageUploadCard label="Take Selfie" uri={docs.selfie} onPress={() => upload("selfie")} />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
      <BottomStickyButton label="Continue to Bank Details" onPress={() => { if (validate()) onNext(docs); }} />
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
  summary: { marginBottom: 20, backgroundColor: "#f0faf2", borderRadius: 14, padding: 14 },
  summaryText: { fontSize: 13, fontWeight: "600", color: COLORS.primary, marginBottom: 8 },
  summaryTrack: { height: 4, backgroundColor: "#d1fae5", borderRadius: 2, overflow: "hidden" },
  summaryFill: { height: "100%", backgroundColor: COLORS.primary, borderRadius: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  uploadRow: { flexDirection: "row", gap: 12 },
  err: { fontSize: 12, color: "#ef4444", marginBottom: 8 },
});
