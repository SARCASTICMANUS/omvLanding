import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export default function AppFrame({ children, title, subtitle, navigation, showBack = true, accent = colors.primary }) {
  return (
    <SafeAreaView style={styles.safe}>
      {(title || showBack) && (
        <View style={styles.header}>
          {showBack ? (
            <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backSpacer} />
          )}
          <View style={styles.headerCopy}>
            {!!title && <Text style={styles.title}>{title}</Text>}
            {!!subtitle && <Text style={[styles.subtitle, { color: accent }]}>{subtitle}</Text>}
          </View>
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backSpacer: {
    width: 40,
    height: 40,
  },
  backText: {
    color: colors.textPrimary,
    fontSize: 32,
    lineHeight: 34,
  },
  headerCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingBottom: spacing.md,
  },
});
