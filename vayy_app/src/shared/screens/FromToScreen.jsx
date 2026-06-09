import React, { useRef } from "react";
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import Logo from "../components/common/Logo";
import PrimaryButton from "../components/common/PrimaryButton";

const recentLocations = ["Charbagh Railway Station", "IT City Gate 3", "Aliganj Bus Stop"];

export function FromToScreen({ navigation, accent = colors.primary, nextRoute = "SharedAutoRouteList", title = "Plan your route" }) {
  const rotate = useRef(new Animated.Value(0)).current;
  const onSwap = () => {
    Animated.timing(rotate, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => rotate.setValue(0));
  };
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <AppFrame navigation={navigation} title={title} accent={accent}>
      <View style={styles.page}>
        <View style={styles.inputPanel}>
          <TextInput style={styles.input} value="Hazratganj Metro Gate 2" placeholderTextColor={colors.textMuted} />
          <Animated.View style={[styles.swap, { transform: [{ rotate: spin }] }]}>
            <TouchableOpacity onPress={onSwap}>
              <Text style={styles.swapText}>⇅</Text>
            </TouchableOpacity>
          </Animated.View>
          <TextInput style={styles.input} placeholder="Where to?" placeholderTextColor={colors.textMuted} />
        </View>
        <Text style={styles.sectionTitle}>Recent locations</Text>
        {recentLocations.map((item) => (
          <View key={item} style={styles.locationRow}>
            <Text style={styles.locationIcon}>◷</Text>
            <Text style={styles.locationText}>{item}</Text>
          </View>
        ))}
        <View style={styles.footer}>
          <PrimaryButton label="Search Routes" accent={accent} onPress={() => navigation.navigate(nextRoute)} />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  inputPanel: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  swap: {
    alignSelf: "center",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  swapText: {
    color: colors.textPrimary,
    fontSize: 22,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginTop: spacing.md,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationIcon: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  locationText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  footer: {
    marginTop: "auto",
  },
});
