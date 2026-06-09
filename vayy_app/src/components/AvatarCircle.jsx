import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export default function AvatarCircle({ initials = "VA", accent = colors.primary }) {
  return (
    <View style={[styles.avatar, { backgroundColor: accent }]}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "900",
  },
});
