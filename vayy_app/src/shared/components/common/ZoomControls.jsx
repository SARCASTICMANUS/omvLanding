import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

export default function ZoomControls({ onZoomIn, onZoomOut, style }) {
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.btn} onPress={onZoomIn}>
        <Text style={styles.text}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={onZoomOut}>
        <Text style={styles.text}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    bottom: 100,
    gap: 10,
  },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 24,
  },
});
