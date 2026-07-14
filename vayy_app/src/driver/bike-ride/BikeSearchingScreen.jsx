import React, { useRef, useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
// import VayyMap, { UserLocation } from "../../shared/components/VayyMap";
import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";

export default function BikeSearchingScreen({ navigation, route }) {
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        {/* <VayyMap
          style={styles.map}
          mapRef={mapRef}
          cameraRef={cameraRef}
          initialViewState={{
            center: [80.9462, 26.8467],
            zoom: 14,
          }}
          onDidFinishLoadingMap={() => setIsMapReady(true)}
        >
          <UserLocation />
        </VayyMap> */}
      </View>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Finding Passengers</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.searchCard}>
            <View style={styles.pulseDot} />
            <Text style={styles.heading}>Searching...</Text>
            <Text style={styles.sub}>
              Waiting for nearby passenger requests
            </Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  mapArea: { ...StyleSheet.absoluteFillObject },
  map: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,152,73,0.85)",
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  pulseDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  cancelText: {
    color: COLORS.danger,
    fontWeight: "900",
    fontSize: 15,
  },
});
