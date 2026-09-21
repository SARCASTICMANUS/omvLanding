import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Bike, Car, CheckCircle, User, CreditCard, Building2, Smartphone, Phone, Calendar, Users } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useDispatch, useSelector } from "react-redux";
import COLORS from "../../../shared/constants/colors";
import ImageUploadCard from "../../components/ImageUploadCard";
import BottomStickyButton from "../../components/BottomStickyButton";
import ApplicationSubmittedScreen from "../ApplicationSubmittedScreen";
import { completeRegistration } from "../../authSlice";
import { uploadDocument } from "../../../store/slices/profileSlice";
import { clearFields } from "../../../store/slices/onboardingSlice";
import { VALIDATORS, VALIDATION_MESSAGES } from "../../validators";
import api from "../../../shared/lib/api";
import { AUTH } from "../../../constants";

const DOC_SECTIONS = [
  { key: "dl", label: "Driving Licence", type: "LICENSE", back: true },
  { key: "rc", label: "RC Book", type: "RC", back: true },
  { key: "insurance", label: "Vehicle Insurance", type: "INSURANCE", back: true },
  { key: "aadhaar", label: "Aadhaar Card", type: "IDENTITY", back: true },
  { key: "selfie", label: "Selfie Verification", type: "IDENTITY", back: false },
];

const parseDobToISO = (dob) => {
  if (!dob) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
  const parts = dob.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
};

export default function DriverProfileCompletionScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const fields = useSelector((state) => state.onboarding.fields);

  // Profile (editable)
  const [fullName, setFullName] = useState(fields.fullName || user?.name || user?.full_name || "");
  const [mobile, setMobile] = useState(fields.mobile || "");
  const [dob, setDob] = useState(fields.dob || "");
  const [gender, setGender] = useState(fields.gender || "");

  // Vehicle
  const [vehicleType, setVehicleType] = useState(fields.vehicleType || "bike");
  const [vehicleNumber, setVehicleNumber] = useState(fields.vehicleNumber || "");
  const [rcNumber, setRcNumber] = useState(fields.rcNumber || "");
  const [vehiclePhotoUri, setVehiclePhotoUri] = useState(null);
  const [vehiclePhotoUploading, setVehiclePhotoUploading] = useState(false);

  // Documents: { dlFront: { uri, id, status }, dlBack: { uri, id, status }, ... }
  const [docs, setDocs] = useState({
    dlFront: { uri: null, id: null, status: "idle" },
    dlBack: { uri: null, id: null, status: "idle" },
    rcFront: { uri: null, id: null, status: "idle" },
    rcBack: { uri: null, id: null, status: "idle" },
    insuranceFront: { uri: null, id: null, status: "idle" },
    insuranceBack: { uri: null, id: null, status: "idle" },
    aadhaarFront: { uri: null, id: null, status: "idle" },
    aadhaarBack: { uri: null, id: null, status: "idle" },
    selfie: { uri: null, id: null, status: "idle" },
  });

  // Bank
  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");

  // UI
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Vehicle Photo Upload ──
  const pickVehiclePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant gallery access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setVehiclePhotoUri(asset.uri);
      setErrors((p) => { const n = { ...p }; delete n.photo; return n; });
    }
  };

  // ── Document Upload ──
  const pickAndUploadDoc = async (field, documentType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant gallery access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    setDocs((p) => ({ ...p, [field]: { ...p[field], uri, status: "uploading" } }));

    try {
      const formData = new FormData();
      formData.append("document_type", documentType);
      formData.append("file", {
        uri,
        name: uri.split("/").pop() || "upload.jpg",
        type: "image/jpeg",
      });
      const response = await api.post(AUTH.driverDocuments, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const docData = response.data?.data || response.data;
      const docId = docData?.id;
      setDocs((p) => ({ ...p, [field]: { uri, id: docId, status: "success" } }));
      setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
    } catch (e) {
      setDocs((p) => ({ ...p, [field]: { uri, id: null, status: "error" } }));
      Alert.alert("Upload Failed", "Could not upload document. Tap to retry.");
    }
  };

  // ── Validation ──
  const validate = () => {
    const e = {};
    if (!VALIDATORS.fullName(fullName)) e.fullName = VALIDATION_MESSAGES.fullName;
    if (!VALIDATORS.mobile(mobile)) e.mobile = VALIDATION_MESSAGES.mobile;
    if (!VALIDATORS.vehicleNumber(vehicleNumber)) e.vehicleNumber = VALIDATION_MESSAGES.vehicleNumber;
    if (!rcNumber || rcNumber.length < 6) e.rcNumber = "Enter a valid RC number (min 6 characters)";

    // Check required docs
    for (const section of DOC_SECTIONS) {
      const frontField = `${section.key}Front`;
      const backField = `${section.key}Back`;
      if (section.back) {
        if (!docs[frontField]?.id) e[frontField] = "Required";
        if (!docs[backField]?.id) e[backField] = "Required";
      } else {
        if (!docs[section.key]?.id) e[section.key] = "Required";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const getDocCount = () => {
    let count = 0;
    for (const section of DOC_SECTIONS) {
      const frontField = `${section.key}Front`;
      const backField = `${section.key}Back`;
      if (section.back) {
        if (docs[frontField]?.id) count++;
        if (docs[backField]?.id) count++;
      } else {
        if (docs[section.key]?.id) count++;
      }
    }
    return count;
  };

  const totalDocs = 9;
  const docCount = getDocCount();

  // ── Submit ──
  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert("Missing Fields", "Please fill all required fields and upload all documents.");
      return;
    }

    setSubmitting(true);
    try {
      const documentIds = [];
      for (const section of DOC_SECTIONS) {
        const frontField = `${section.key}Front`;
        const backField = `${section.key}Back`;
        if (section.back) {
          if (docs[frontField]?.id) documentIds.push(docs[frontField].id);
          if (docs[backField]?.id) documentIds.push(docs[backField].id);
        } else {
          if (docs[section.key]?.id) documentIds.push(docs[section.key].id);
        }
      }

      const bankDetails = {};
      if (holderName || accountNumber || ifsc) {
        bankDetails.holder_name = holderName;
        bankDetails.account_number = accountNumber;
        bankDetails.ifsc = ifsc;
        bankDetails.upi = upi;
      }

      const dobFormatted = parseDobToISO(dob);
      const role = vehicleType === "auto" ? "autodriver" : "bikedriver";

      const result = await dispatch(
        completeRegistration({
          display_name: fullName,
          phone_number: mobile,
          dob: dobFormatted,
          gender: gender,
          vehicle_type: vehicleType,
          vehicle_number: vehicleNumber,
          vehicle_photo: "",
          rc_number: rcNumber,
          document_ids: documentIds,
          bank_details: bankDetails,
          role,
        }),
      );

      setSubmitting(false);

      if (completeRegistration.rejected.match(result)) {
        const errorMsg =
          result.payload?.vehicle_number?.[0] ||
          result.payload?.error ||
          result.payload?.message ||
          "Submission failed";
        Alert.alert("Registration Failed", errorMsg);
        return;
      }

      dispatch(clearFields());
      setSubmitted(true);
    } catch {
      setSubmitting(false);
      Alert.alert("Registration Failed", "Something went wrong. Please try again.");
    }
  };

  const onBack = () => navigation.goBack();

  if (submitted) {
    return (
      <ApplicationSubmittedScreen onCta={() => navigation.navigate("DriverTabs")} />
    );
  }

  const inputStyle = (f) => [styles.inputWrap, errors[f] && styles.inputError];

  return (
    <SafeAreaView style={styles.root}>
      <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Profile</Text>
        <Text style={styles.sub}>Fill in your details to start driving</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* ── PROFILE SECTION ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Details</Text>

            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrap}>
              <User size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="As per Aadhaar"
                placeholderTextColor="#aaa"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <Text style={styles.label}>Phone Number</Text>
            <View style={inputStyle("mobile")}>
              <Phone size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor="#aaa"
                value={mobile}
                onChangeText={(v) => setMobile(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            {errors.mobile && <Text style={styles.err}>{errors.mobile}</Text>}

            <Text style={styles.label}>Date of Birth</Text>
            <View style={styles.inputWrap}>
              <Calendar size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#aaa"
                value={dob}
                onChangeText={setDob}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>

            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {["Male", "Female", "Other"].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderPill, gender === g && styles.genderPillActive]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.genderText, gender === g && { color: "#fff" }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── VEHICLE SECTION ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Details</Text>

            <Text style={styles.label}>Vehicle Type</Text>
            <View style={styles.vehicleRow}>
              {[
                { key: "bike", label: "Bike", icon: Bike },
                { key: "auto", label: "Auto", icon: Car },
              ].map((v) => {
                const active = vehicleType === v.key;
                const Icon = v.icon;
                return (
                  <TouchableOpacity
                    key={v.key}
                    style={[styles.vehicleCard, active && styles.vehicleCardActive]}
                    onPress={() => setVehicleType(v.key)}
                    activeOpacity={0.85}
                  >
                    <Icon size={20} color={active ? "#fff" : COLORS.textMuted} />
                    <Text style={[styles.vehicleLabel, active && { color: "#fff" }]}>{v.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Vehicle Number</Text>
            <View style={inputStyle("vehicleNumber")}>
              <TextInput
                style={styles.input}
                placeholder="UP32AB1234"
                placeholderTextColor="#aaa"
                value={vehicleNumber}
                onChangeText={(v) => setVehicleNumber(v.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
            {errors.vehicleNumber && <Text style={styles.err}>{errors.vehicleNumber}</Text>}

            <Text style={styles.label}>RC Number</Text>
            <View style={inputStyle("rcNumber")}>
              <TextInput
                style={styles.input}
                placeholder="Enter RC number"
                placeholderTextColor="#aaa"
                value={rcNumber}
                onChangeText={(v) => setRcNumber(v.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
            {errors.rcNumber && <Text style={styles.err}>{errors.rcNumber}</Text>}

            <Text style={styles.label}>{vehicleType === "auto" ? "Auto" : "Bike"} Photo</Text>
            <ImageUploadCard
              label={vehiclePhotoUploading ? "Uploading..." : "Tap to upload photo"}
              uri={vehiclePhotoUri}
              onPress={pickVehiclePhoto}
              status={vehiclePhotoUploading ? "uploading" : "idle"}
            />
          </View>

          {/* ── DOCUMENTS SECTION ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Documents</Text>
              <Text style={styles.docCount}>{docCount}/{totalDocs} uploaded</Text>
            </View>

            {DOC_SECTIONS.map((section) => (
              <View key={section.key} style={styles.docSection}>
                <Text style={styles.docLabel}>{section.label}</Text>
                <View style={styles.uploadRow}>
                  <ImageUploadCard
                    label="Front"
                    uri={docs[`${section.key}Front`]?.uri}
                    onPress={() => pickAndUploadDoc(`${section.key}Front`, section.type)}
                    status={docs[`${section.key}Front`]?.status}
                  />
                  {section.back && (
                    <ImageUploadCard
                      label="Back"
                      uri={docs[`${section.key}Back`]?.uri}
                      onPress={() => pickAndUploadDoc(`${section.key}Back`, section.type)}
                      status={docs[`${section.key}Back`]?.status}
                    />
                  )}
                </View>
                {(errors[`${section.key}Front`] || errors[`${section.key}Back`] || errors[section.key]) && (
                  <Text style={styles.err}>Both sides required</Text>
                )}
              </View>
            ))}
          </View>

          {/* ── BANK SECTION ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bank Details</Text>
            <Text style={styles.sectionSub}>Optional — add for payouts</Text>

            <Text style={styles.label}>Account Holder Name</Text>
            <View style={styles.inputWrap}>
              <User size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="As per bank records"
                placeholderTextColor="#aaa"
                value={holderName}
                onChangeText={setHolderName}
                autoCapitalize="words"
              />
            </View>

            <Text style={styles.label}>Account Number</Text>
            <View style={styles.inputWrap}>
              <CreditCard size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="Enter account number"
                placeholderTextColor="#aaa"
                value={accountNumber}
                onChangeText={(v) => setAccountNumber(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.label}>IFSC Code</Text>
            <View style={styles.inputWrap}>
              <Building2 size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="SBIN0001234"
                placeholderTextColor="#aaa"
                value={ifsc}
                onChangeText={(v) => setIfsc(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={11}
              />
            </View>

            <Text style={styles.label}>UPI ID <Text style={{ fontWeight: "400", color: "#9ca3af" }}>(Optional)</Text></Text>
            <View style={styles.inputWrap}>
              <Smartphone size={16} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="name@upi"
                placeholderTextColor="#aaa"
                value={upi}
                onChangeText={setUpi}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomStickyButton
        label={submitting ? "Submitting..." : "Submit Registration"}
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
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
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 12 },
  sectionSub: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8, marginTop: -8 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  docCount: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 6, marginTop: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 14, paddingHorizontal: 14, height: 52, backgroundColor: "#fafafa", gap: 10 },
  inputError: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  input: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  err: { fontSize: 12, color: "#ef4444", marginTop: 4, marginBottom: 4, marginLeft: 4 },
  vehicleRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  vehicleCard: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: "#e5e7eb", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fafafa" },
  vehicleCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  vehicleLabel: { fontSize: 14, fontWeight: "600", color: COLORS.textMuted },
  docSection: { marginBottom: 16 },
  docLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 8 },
  uploadRow: { flexDirection: "row", gap: 12 },
  genderRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  genderPill: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" },
  genderPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  genderText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
});
