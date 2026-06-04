import React from "react";
import { StyleSheet, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";
import SHADOW from "../../constants/shadow";
import SPACING from "../../constants/spacing";

export default function VayyCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    ...SHADOW.sm,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.base,
  },
});
