import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import COLORS from "../../shared/constants/colors";

export default function ImageUploadCard({ label, uri, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {uri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri }} style={styles.preview} />
          <View style={styles.retakeOverlay}>
            <Text style={styles.retakeText}>Tap to Retake</Text>
          </View>
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
  card: { width: "48%", height: 140, borderRadius: 14, borderWidth: 1.5, borderColor: "#e5e7eb", borderStyle: "dashed", overflow: "hidden" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" },
  plus: { fontSize: 28, color: COLORS.textLight, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, textAlign: "center" },
  previewWrap: { flex: 1 },
  preview: { flex: 1, resizeMode: "cover" },
  retakeOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)", paddingVertical: 6, alignItems: "center" },
  retakeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
