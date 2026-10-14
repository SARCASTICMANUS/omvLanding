import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import ScreenHeader from "../shared/components/navigation/ScreenHeader";

export default function AppFrame({ children, title, subtitle, navigation, showBack = true, accent = colors.primary }) {
  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      {(title || showBack) && (
        <ScreenHeader
          title={title || " "}
          subtitle={subtitle}
          onBack={showBack ? () => navigation?.goBack() : undefined}
          backgroundColor={accent}
        />
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
  content: {
    flex: 1,
    paddingBottom: spacing.md,
  },
});
