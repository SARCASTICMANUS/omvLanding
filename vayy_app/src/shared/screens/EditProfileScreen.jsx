import React, { useState } from "react";
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
import { updateProfile } from "../../store/slices/profileSlice";

import COLORS from "../constants/colors";
import RADIUS from "../constants/radius";
import SPACING from "../constants/spacing";
import VayyButton from "../components/common/VayyButton";
import { DRIVER_ROLES } from "../../constants";
import { notifyAction } from "../lib/confirmAction";

export default function EditProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { data: profile, loading } = useSelector((state) => state.profile);

  const isDriver = DRIVER_ROLES.includes(user?.role);

  const [form, setForm] = useState({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    display_name: profile?.display_name || "",
    phone_number: profile?.phone_number || "",
    bio: profile?.bio || "",
    profile_photo: profile?.profile_photo || "",
    ...(isDriver ? { license_number: profile?.license_number || "" } : {}),
  });

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      notifyAction({ title: "Permission needed", message: "Please allow access to your photos to upload a profile picture." });
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
      notifyAction({ title: "Error", message: result.payload?.message || "Failed to update profile" });
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
