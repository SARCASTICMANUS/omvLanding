import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from "react-native";
import { XCircle } from "lucide-react-native";
import COLORS from "../../shared/constants/colors";

export default function ImageUploadCard({ label, uri, onPress, status }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {status === "uploading" ? (
        <View style={styles.uploadingWrap}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      ) : uri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.retakeOverlay}>
            <Text style={styles.retakeText}>Tap to Retake</Text>
          </View>
        </View>
      ) : status === "error" ? (
        <View style={styles.errorWrap}>
          <XCircle size={24} color={COLORS.error} />
          <Text style={styles.errorText}>Failed</Text>
          <Text style={styles.errorSubText}>Tap to retry</Text>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: "48%", height: 140, borderRadius: 14, borderWidth: 1.5, borderColor: "#e5e7eb", borderStyle: "dashed", overflow: "hidden", backgroundColor: "#fafafa" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" },
  plus: { fontSize: 28, color: COLORS.textLight, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, textAlign: "center" },
  previewWrap: { flex: 1 },
  preview: { flex: 1 },
  retakeOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)", paddingVertical: 6, alignItems: "center" },
  retakeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  uploadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  uploadingText: { marginTop: 8, color: COLORS.primary, fontSize: 12 },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  errorText: { fontSize: 24, color: COLORS.error, marginBottom: 4 },
  errorSubText: { color: COLORS.textMuted, fontSize: 11 },
});
