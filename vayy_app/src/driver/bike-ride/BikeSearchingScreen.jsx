import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";

export default function BikeSearchingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.marker}>{"[Searching]"}</Text>
        <Text style={styles.heading}>Finding Passengers</Text>
        <Text style={styles.sub}>
          Waiting for nearby passenger requests...
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: SPACING.xl, gap: SPACING.md },
  marker: { fontSize: 36, fontWeight: "900", color: COLORS.primary },
  heading: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  sub: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1, borderColor: COLORS.danger, marginTop: SPACING.xl },
  cancelText: { color: COLORS.danger, fontWeight: "900", fontSize: 15 },
});
