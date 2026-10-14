import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, shadow } from "../../../constants/theme";

/**
 * Single header bar for every passenger + driver screen.
 *
 * One fixed content height, one title size, one subtitle size and one back
 * button so headers never shift between screens. Home, Profile and the
 * passenger trip-planner screen keep their own bespoke layouts.
 */
export const HEADER_CONTENT_HEIGHT = 56;

// Horizontal inset for headers with a back button.
// NOTE: these are plain numbers, NOT styles. They must live outside
// StyleSheet.create — react-native-web compiles every entry of a
// StyleSheet.create call and crashes with "Invalid value used as weak map key"
// when an entry is a number/string instead of a style object.
const HEADER_INSET = 16;
// Header without a back button — title sits close to the screen edge.
const BARE_INSET = 30;

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  backgroundColor = colors.primary,
  textColor = colors.white,
  subtitleColor = "rgba(255,255,255,0.75)",
  radius: cornerRadius = 32,
  absolute = false,
  zIndex = 10,
}) {
  const insets = useSafeAreaInsets();
  // Tab roots have no back button, so they drop the 40px button slot entirely
  // and pull the title in to a 10px inset. Keeping the slot (even as an empty
  // spacer) would leave the title indented ~50px from the screen edge.
  const bare = !onBack;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor,
          paddingTop: insets.top + 8,
          paddingHorizontal: bare ? BARE_INSET : HEADER_INSET,
          borderBottomLeftRadius: cornerRadius,
          borderBottomRightRadius: cornerRadius,
          ...(absolute ? styles.absolute : null),
          zIndex,
        },
      ]}
    >
      <View style={styles.gradient} pointerEvents="none">
        <View style={[styles.ray, styles.rayOne]} />
        <View style={[styles.ray, styles.rayTwo]} />
      </View>

      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={6}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.titles}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingBottom: 12,
    overflow: "hidden",
    ...shadow.md,
  },
  absolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  ray: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 120,
  },
  rayOne: {
    top: -60,
    right: -40,
    width: "70%",
    height: "90%",
    transform: [{ rotate: "25deg" }],
  },
  rayTwo: {
    top: -80,
    right: -20,
    width: "50%",
    height: "70%",
    transform: [{ rotate: "35deg" }],
  },
  row: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.sm,
  },
  // Titles stay left-aligned. `flex: 1` (flexBasis 0) is what makes the text
  // visible and truncating — do not override it with a bare flexGrow/flexShrink.
  titles: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
});
