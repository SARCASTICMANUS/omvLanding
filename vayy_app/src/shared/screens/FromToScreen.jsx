import React, { useRef } from "react";
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import Logo from "../components/common/Logo";
import PrimaryButton from "../components/common/PrimaryButton";

export default function FromToScreen({ navigation, route, accent = colors.primary, nextRoute = "SharedAutoRouteList", title = "Plan your route" }) {
  const pickup = route?.params?.pickup || "";
  const recentLocations = route?.params?.recentLocations || [];
  const rotate = useRef(new Animated.Value(0)).current;
  const onSwap = () => {
    Animated.timing(rotate, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => rotate.setValue(0));
  };
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <AppFrame navigation={navigation} title={title} accent={accent}>
      <View style={styles.page}>
        <View style={styles.inputPanel}>
          <TextInput style={styles.input} value={pickup} placeholderTextColor={colors.textMuted} editable={false} />
          <Animated.View style={[styles.swap, { transform: [{ rotate: spin }] }]}>
            <TouchableOpacity onPress={onSwap}>
              <Text style={styles.swapText}>⇅</Text>
            </TouchableOpacity>
          </Animated.View>
          <TextInput style={styles.input} placeholder="Where to?" placeholderTextColor={colors.textMuted} />
        </View>
        <Text style={styles.sectionTitle}>Recent locations</Text>
        {recentLocations.length > 0 ? recentLocations.map((item) => (
          <View key={item} style={styles.locationRow}>
            <Text style={styles.locationIcon}>◷</Text>
            <Text style={styles.locationText}>{item}</Text>
          </View>
        )) : (
          <Text style={styles.locationText}>No recent locations</Text>
        )}
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
