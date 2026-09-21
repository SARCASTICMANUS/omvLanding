import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { updateProfile, fetchVerificationStatus } from "../../store/slices/profileSlice";

import COLORS from "../constants/colors";
import RADIUS from "../constants/radius";
import SPACING from "../constants/spacing";
import VayyButton from "../components/common/VayyButton";
import { DRIVER_ROLES } from "../../constants";

const VEHICLE_TYPES = [
  { label: "Bike", value: "bike" },
  { label: "Auto", value: "auto" },
];

const DOC_TYPES = [
  { key: "LICENSE", label: "Driving License", icon: "card-outline" },
  { key: "RC", label: "Vehicle RC", icon: "document-text-outline" },
  { key: "INSURANCE", label: "Insurance", icon: "shield-checkmark-outline" },
  { key: "IDENTITY", label: "ID Proof", icon: "finger-print-outline" },
];

const DRIVER_DOC_TYPES = [
  { key: "LICENSE", label: "DL Number", icon: "card-outline" },
  { key: "RC", label: "Vehicle RC", icon: "document-text-outline" },
  { key: "INSURANCE", label: "Insurance", icon: "shield-checkmark-outline" },
  { key: "IDENTITY", label: "ID - Company/College I-Card", icon: "finger-print-outline" },
];

const STATUS_COLORS = {
  PENDING: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  VERIFIED: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  REJECTED: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

export default function EditProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { data: profile, loading, verification } = useSelector((state) => state.profile);

  const isDriver = DRIVER_ROLES.includes(user?.role);

  const [form, setForm] = useState({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    display_name: profile?.display_name || "",
    phone_number: profile?.phone_number || "",
    bio: profile?.bio || "",
    profile_photo: profile?.profile_photo || "",
    ...(isDriver
      ? {
          license_number: profile?.license_number || "",
          vehicle_number: profile?.vehicle_number || "",
          vehicle_type: profile?.vehicle_type || "auto",
        }
      : {}),
  });

  useEffect(() => {
    if (isDriver) {
      dispatch(fetchVerificationStatus());
    }
  }, [dispatch, isDriver]);

  // Re-fetch verification status when coming back from image picker or returning to screen
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      dispatch(fetchVerificationStatus());
    });
    return unsub;
  }, [navigation, dispatch]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photos to upload a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      updateField("profile_photo", result.assets[0].uri);
    }
  };

  const getDocStatus = (docType) => {
    const docs = verification?.documents || [];
    return docs.find((d) => d.document_type === docType);
  };

  const handleSave = async () => {
    const payload = { ...form };
    if (!isDriver) {
      delete payload.license_number;
      delete payload.vehicle_number;
      delete payload.vehicle_type;
    }
    const result = await dispatch(updateProfile(payload));
    if (updateProfile.fulfilled.match(result)) {
      navigation.goBack();
    } else {
      Alert.alert("Error", result.payload?.message || "Failed to update profile");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={form.first_name}
              onChangeText={(v) => updateField("first_name", v)}
              placeholder="Enter first name"
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={form.last_name}
              onChangeText={(v) => updateField("last_name", v)}
              placeholder="Enter last name"
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={form.display_name}
              onChangeText={(v) => updateField("display_name", v)}
              placeholder="Enter display name"
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={form.phone_number}
              onChangeText={(v) => updateField("phone_number", v)}
              placeholder="Enter phone number"
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.bio}
              onChangeText={(v) => updateField("bio", v)}
              placeholder="Tell us about yourself"
              placeholderTextColor={COLORS.textLight}
              multiline
              numberOfLines={3}
            />
          </View>

          {!isDriver && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Profile Photo</Text>
              <TouchableOpacity style={styles.photoPicker} onPress={pickImage} activeOpacity={0.7}>
                {form.profile_photo ? (
                  <Image source={{ uri: form.profile_photo }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>Tap to choose photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isDriver && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>License Number</Text>
                <TextInput
                  style={styles.input}
                  value={form.license_number}
                  onChangeText={(v) => updateField("license_number", v)}
                  placeholder="Enter license number"
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Vehicle Number</Text>
                <TextInput
                  style={styles.input}
                  value={form.vehicle_number}
                  onChangeText={(v) => updateField("vehicle_number", v)}
                  placeholder="Enter vehicle number"
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Vehicle Type</Text>
                <View style={styles.chipRow}>
                  {VEHICLE_TYPES.map((vt) => (
                    <TouchableOpacity
                      key={vt.value}
                      style={[
                        styles.chip,
                        form.vehicle_type === vt.value && styles.chipActive,
                      ]}
                      onPress={() => updateField("vehicle_type", vt.value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          form.vehicle_type === vt.value && styles.chipTextActive,
                        ]}
                      >
                        {vt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {isDriver && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionLabel}>Documents & Verification</Text>
              {(isDriver ? DRIVER_DOC_TYPES : DOC_TYPES).map((doc) => {
                const docStatus = getDocStatus(doc.key);
                const statusKey = docStatus?.status || null;
                const statusColor = statusKey ? STATUS_COLORS[statusKey] : null;
                return (
                  <View
                    key={doc.key}
                    style={styles.docRow}
                  >
                    <View style={styles.docLeft}>
                      <Ionicons name={doc.icon} size={20} color={COLORS.textLight} />
                      <Text style={styles.docLabel}>{doc.label}</Text>
                    </View>
                    <View style={styles.docRight}>
                      {statusKey ? (
                        <View style={styles.docUploaded}>
                          <View style={[styles.docBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
                            <Text style={[styles.docBadgeText, { color: statusColor.text }]}>{statusKey}</Text>
                          </View>
                        </View>
                      ) : (
                        <Ionicons name="cloud-upload-outline" size={18} color={COLORS.textLight} />
                      )}
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.reuploadBtn}
                onPress={() => navigation.navigate("DriverProfileCompletion")}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                <Text style={styles.reuploadBtnText}>Manage Documents</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.spacer} />

          <VayyButton
            label="Save Changes"
            onPress={handleSave}
            loading={loading}
            fullWidth
            size="lg"
          />

          <VayyButton
            label="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            fullWidth
            size="lg"
            style={styles.cancelBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: "700",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  container: {
    padding: SPACING.base,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  spacer: {
    height: SPACING.lg,
  },
  cancelBtn: {
    marginTop: SPACING.md,
  },
  sectionWrap: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  docLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  docLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
  },
  docRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  docUploaded: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  docBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  reuploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    backgroundColor: "#f0fdf4",
  },
  reuploadBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  photoPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.surfaceElevated || "#F3F4F6",
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: "600",
    textAlign: "center",
  },
});
