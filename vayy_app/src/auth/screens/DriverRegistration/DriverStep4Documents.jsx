import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import ImageUploadCard from "../../components/ImageUploadCard";
import BottomStickyButton from "../../components/BottomStickyButton";
import { useSelector, useDispatch } from "react-redux";
import { setField } from "../../../store/slices/onboardingSlice";

const { width } = Dimensions.get("window");

const SECTIONS = [
  { key: "dl", label: "Driving Licence" },
  { key: "aadhaar", label: "Aadhaar Card" },
  { key: "selfie", label: "Selfie Verification" },
];

export default function DriverStep4Documents({ onNext, onBack }) {
  const dispatch = useDispatch();
  const fields = useSelector((state) => state.onboarding.fields);
  const [docs, setDocs] = useState({ dlFront: null, dlBack: null, aadhaarFront: null, aadhaarBack: null, selfie: null });
  const [errors, setErrors] = useState({});
  const [uploadStatus, setUploadStatus] = useState({ dlFront: "idle", dlBack: "idle", aadhaarFront: "idle", aadhaarBack: "idle", selfie: "idle" });

  const upload = async (field) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant gallery access to upload documents.");
      return;
    }
    setUploadStatus((prev) => ({ ...prev, [field]: "uploading" }));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setDocs((p) => ({ ...p, [field]: result.assets[0].uri }));
      setUploadStatus((prev) => ({ ...prev, [field]: "success" }));
      dispatch(setField({ field: `doc_${field}`, value: result.assets[0].uri }));
    } else {
      setUploadStatus((prev) => ({ ...prev, [field]: "idle" }));
    }
  };

  const completed = SECTIONS.reduce((acc, s) => {
    const docKey = `doc_${s.key}`;
    const sliceValue = fields[docKey];
    const localValue = docs[s.key];
    if (s.key === "dl") acc[s.key] = !!(localValue.dlFront && localValue.dlBack) || !!sliceValue.dlFront;
    else if (s.key === "aadhaar") acc[s.key] = !!(localValue.aadhaarFront && localValue.aadhaarBack) || !!sliceValue.aadhaarFront;
    else acc[s.key] = !!localValue.selfie || !!sliceValue.selfie;
    return acc;
  }, {});

  const validate = () => {
    const e = {};
    const dlOk = !!(docs.dlFront && docs.dlBack) || !!fields.doc_dlFront;
    const aadhaarOk = !!(docs.aadhaarFront && docs.aadhaarBack) || !!fields.doc_aadhaarFront;
    const selfieOk = !!docs.selfie || !!fields.doc_selfie;
    if (!dlOk) e.dl = "Upload both sides of your Driving Licence";
    if (!aadhaarOk) e.aadhaar = "Upload both sides of your Aadhaar";
    if (!selfieOk) e.selfie = "Take a selfie for verification";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const canProceed = Object.values(completed).reduce((acc, val) => acc && val, true);

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
            {errors.dl && <Text style={styles.err}>dl error</Text>}
          </View>
          {errors.dl && <Text style={styles.err}>dl error</Text>}
          <View style={styles.uploadRow}>
            <ImageUploadCard
              label="Upload Front"
              uri={docs.dlFront}
              onPress={() => upload("dlFront")}
              status={uploadStatus.dlFront}
            />
            <ImageUploadCard
              label="Upload Back"
              uri={docs.dlBack}
              onPress={() => upload("dlBack")}
              status={uploadStatus.dlBack}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aadhaar Card</Text>
            {completed.aadhaar && <CheckCircle size={18} color={COLORS.primary} />}
            {errors.aadhaar && <Text style={styles.err}>aadhaar error</Text>}
          </View>
          {errors.aadhaar && <Text style={styles.err}>aadhaar error</Text>}
          <View style={styles.uploadRow}>
            <ImageUploadCard
              label="Upload Front"
              uri={docs.aadhaarFront}
              onPress={() => upload("aadhaarFront")}
              status={uploadStatus.aadhaarFront}
            />
            <ImageUploadCard
              label="Upload Back"
              uri={docs.aadhaarBack}
              onPress={() => upload("aadhaarBack")}
              status={uploadStatus.aadhaarBack}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Selfie Verification</Text>
            {completed.selfie && <CheckCircle size={18} color={COLORS.primary} />}
            {errors.selfie && <Text style={styles.err}>selfie error</Text>}
          </View>
          {errors.selfie && <Text style={styles.err}>selfie error</Text>}
          <ImageUploadCard
            label="Take Selfie"
            uri={docs.selfie}
            onPress={() => upload("selfie")}
            status={uploadStatus.selfie}
          />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
      <BottomStickyButton
        label="Continue to Bank Details"
        disabled={!canProceed}
        onPress={() => { if (validate()) onNext(docs); }}
      />
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