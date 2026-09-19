import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, KeyboardAvoidingView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import COLORS from "../../../shared/constants/colors";
import ProgressBar from "../../components/ProgressBar";
import ImageUploadCard from "../../components/ImageUploadCard";
import BottomStickyButton from "../../components/BottomStickyButton";
import { useSelector, useDispatch } from "react-redux";
import { setField } from "../../../store/slices/onboardingSlice";
import { VALIDATORS, VALIDATION_MESSAGES } from "../../validators";

export default function DriverStep3VehicleInfo({ onNext, onBack, vehicleType }) {
  const dispatch = useDispatch();
  const fields = useSelector((state) => state.onboarding.fields);
  const isAuto = vehicleType === "auto";
  const [form, setForm] = useState({ vehicleNumber: "", rcNumber: "", autoType: "Standard" });
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [converting, setConverting] = useState(false);
  const [focused, setFocused] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm({
      vehicleNumber: fields.vehicleNumber || "",
      rcNumber: fields.rcNumber || "",
      autoType: fields.autoType || "Standard",
    });
  }, [fields]);

  const update = (f, v) => {
    setForm((p) => ({ ...p, [f]: v }));
    dispatch(setField({ field: f, value: v }));
  };

  const validate = () => {
    const e = {};
    if (!VALIDATORS.vehicleNumber(form.vehicleNumber)) e.vehicleNumber = VALIDATION_MESSAGES.vehicleNumber;
    if (!form.rcNumber || form.rcNumber.length < 6) e.rcNumber = "Enter a valid RC number (min 6 characters)";
    if (!photoBase64) e.photo = `Upload ${isAuto ? "auto" : "bike"} photo`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputStyle = (f) => [styles.inputWrap, focused[f] && styles.inputFocused, errors[f] && styles.inputError];

  const handleUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant gallery access to upload a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      setConverting(true);
      const base64 = result.assets[0].base64;
      setConverting(false);
      if (base64) {
        setPhotoBase64(base64);
        setErrors((prev) => ({ ...prev, photo: undefined }));
      } else {
        Alert.alert("Conversion Failed", "Could not process the image. Please try selecting it again.");
        setPhotoUri(null);
      }
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>Vehicle Information</Text>
          <Text style={styles.sub}>{isAuto ? "Tell us about your auto" : "Tell us about your bike"}</Text>
        </View>
        <ProgressBar current={4} total={7} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Vehicle Number</Text>
          <View style={inputStyle("vehicleNumber")}>
            <TextInput style={styles.input} placeholder="UP32AB1234" placeholderTextColor="#aaa" value={form.vehicleNumber} onChangeText={(v) => update("vehicleNumber", v.toUpperCase())} autoCapitalize="characters" onFocus={() => setFocused({ vehicleNumber: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.vehicleNumber && <Text style={styles.err}>{errors.vehicleNumber}</Text>}
          <Text style={styles.label}>RC Number</Text>
          <View style={inputStyle("rcNumber")}>
            <TextInput style={styles.input} placeholder="Enter RC number" placeholderTextColor="#aaa" value={form.rcNumber} onChangeText={(v) => update("rcNumber", v.toUpperCase())} autoCapitalize="characters" onFocus={() => setFocused({ rcNumber: true })} onBlur={() => setFocused({})} />
          </View>
          {errors.rcNumber && <Text style={styles.err}>{errors.rcNumber}</Text>}
          {isAuto && (
            <>
              <Text style={styles.label}>Auto Type</Text>
              <View style={styles.typeRow}>
                {["Standard", "Electric", "Premium"].map((t) => (
                  <TouchableOpacity key={t} style={[styles.typePill, form.autoType === t && styles.typePillActive]} onPress={() => update("autoType", t)}>
                    <Text style={[styles.typeText, form.autoType === t && styles.typeTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <Text style={styles.label}>{isAuto ? "Vehicle Photo" : "Bike Photo"}</Text>
          <View style={styles.uploadRow}>
            <ImageUploadCard label={converting ? "Converting..." : `Tap to upload ${isAuto ? "auto" : "bike"} photo`} uri={photoUri} onPress={handleUpload} />
          </View>
          {errors.photo && <Text style={styles.err}>{errors.photo}</Text>}
          <View style={{ height: 80 }} />
        </ScrollView>
        <BottomStickyButton label="Continue to Documents" onPress={() => { if (validate()) onNext({ vehicleNumber: form.vehicleNumber, rcNumber: form.rcNumber, photo: photoBase64 }); }} />
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
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 14, paddingHorizontal: 14, height: 52, backgroundColor: "#fafafa" },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: "#f0faf2" },
  inputError: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  input: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  err: { fontSize: 12, color: "#ef4444", marginTop: 4, marginBottom: 4, marginLeft: 4 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  typePill: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" },
  typePillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  typeText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  typeTextActive: { color: "#fff" },
  uploadRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
});
