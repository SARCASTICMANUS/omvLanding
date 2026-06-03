import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import COLORS from "../../constants/colors";
import SPACING from "../../constants/spacing";

export default function BottomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title || route.name;
        const isFocused = state.index === index;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={styles.tab}
          >
            <View style={[styles.iconDot, isFocused && styles.iconDotActive]} />
            <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: "row",
    height: 60,
    justifyContent: "space-around",
    paddingBottom: 10,
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: SPACING.xs,
    justifyContent: "center",
  },
  iconDot: {
    backgroundColor: COLORS.textLight,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  iconDotActive: {
    backgroundColor: COLORS.primary,
  },
  label: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: "700",
  },
  labelActive: {
    color: COLORS.primary,
  },
});
