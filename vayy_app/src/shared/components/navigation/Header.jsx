import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import COLORS from "../../constants/colors";
import SPACING from "../../constants/spacing";

export default function Header({ title, subtitle, onBack, right }) {
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>{"<"}</Text>
          </TouchableOpacity>
        ) : null}
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  left: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  backButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  backText: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "500",
    lineHeight: 36,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
});
